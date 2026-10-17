import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import type { Ctx } from "../app.js";
import { audit } from "../audit.js";
import type { AuthUser } from "../auth.js";
import { AppError } from "../errors.js";
import { compressImage } from "../fileStore.js";
import { BLUR_THRESHOLD, laplacianVariance } from "../services/image-quality.js";
import { normalizeDob } from "../services/matcher.js";
import { evaluate } from "../services/evaluate.js";
import { DOC_KINDS, makeMismatch, type Mismatch } from "../services/mismatches.js";
import { aadhaarLast4, isValidAadhaar, isValidIfsc, isValidPan } from "../services/validators.js";
import { assertTransition } from "../status.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) =>
    /^image\/(jpeg|png|webp|heic|heif)$/.test(file.mimetype) ? cb(null, true) : cb(new AppError(415, "images_only", "Only image files are accepted")),
});

const extractBody = z.object({ appId: z.string().min(1), kind: z.enum(DOC_KINDS) });

/** Documents can be added while the application is waiting for them or being fixed. */
const EDITABLE = ["docs_pending", "needs_fix", "sent_back"];

async function loadOwnApp(ctx: Ctx, user: AuthUser, appId: string) {
  const app = await ctx.store.get(`applications/${appId}`);
  if (!app) throw new AppError(404, "not_found", "Application not found");
  if (app.customerUid !== user.uid) throw new AppError(403, "forbidden", "Not your application");
  if (!EDITABLE.includes(app.status)) throw new AppError(409, "wrong_status", `Documents cannot be changed while the application is ${app.status}`);
  return app;
}

export const documentsRouter = (ctx: Ctx) =>
  Router().post("/extract", upload.single("image"), async (req, res, next) => {
    try {
      if (!req.file) throw new AppError(400, "no_image", "Missing 'image' file");
      const { appId, kind } = extractBody.parse(req.body);
      const app = await loadOwnApp(ctx, req.user!, appId);

      let jpeg: Buffer;
      try { jpeg = await compressImage(req.file.buffer); }
      catch (e) { throw e instanceof AppError ? e : new AppError(415, "bad_image", "Could not read the image"); }

      const ex = await ctx.extract.extractDoc(kind, jpeg, "image/jpeg");
      const blurScore = await laplacianVariance(jpeg);
      const blurry = ex.blurry || blurScore < BLUR_THRESHOLD;

      // Validate; the full Aadhaar number is reduced to last 4 + valid and dropped here.
      const valid =
        !blurry &&
        (kind === "aadhaar" ? !!ex.number && isValidAadhaar(ex.number)
          : kind === "pan" ? !!ex.number && isValidPan(ex.number)
          : !!ex.ifsc && isValidIfsc(ex.ifsc));

      const fields: Record<string, string | null> = { name: ex.name, dob: ex.dob ? normalizeDob(ex.dob) : null };
      if (kind === "pan") fields.pan = ex.number?.toUpperCase() ?? null;
      if (kind === "passbook") fields.ifsc = ex.ifsc;
      const doc = {
        fields,
        confidence: ex.confidence,
        ...(kind === "aadhaar" ? { aadhaarLast4: ex.number ? aadhaarLast4(ex.number) : null } : {}),
        valid,
        blurry,
        uploadedAt: new Date().toISOString(),
      };

      await ctx.files.put(appId, kind, jpeg, "image/jpeg", { precompressed: true });
      await ctx.store.set(`applications/${appId}`, { ...app, documents: { ...(app.documents ?? {}), [kind]: doc }, updatedAt: new Date().toISOString() });
      await audit(ctx.store, req.user!, "document.extract", appId, { kind, valid, blurry });

      const issues: Mismatch[] = [];
      if (blurry) issues.push(makeMismatch("PHOTO_BLURRY", kind));
      else if (!valid) issues.push(makeMismatch(kind === "aadhaar" ? "AADHAAR_INVALID" : kind === "pan" ? "PAN_INVALID" : "IFSC_INVALID", kind));
      res.json({ kind, ...doc, issues, blurScore: Math.round(blurScore * 10) / 10, blurThreshold: BLUR_THRESHOLD });
    } catch (e) { next(e); }
  });

/** Runs matcher + validators, stores mismatches + readiness, updates status. Shared by /check and /resolve-name. */
async function runCheck(ctx: Ctx, user: AuthUser, appId: string, app: Record<string, any>) {
  const { mismatches, readiness, blocking, eligible } = evaluate(app);

  // Count each (code, document) problem once, the first time it is caught.
  const key = (m: { code: string; doc?: string }) => `${m.code}:${m.doc ?? ""}`;
  const seen = new Set<string>((app.mismatches ?? []).map(key));
  const fresh = mismatches.filter((m) => !seen.has(key(m))).length;

  let status = app.status as string;
  // SPEC: sent_back -> needs_fix once the customer starts fixing (a check run is that signal).
  if (status === "sent_back") { assertTransition("sent_back", "needs_fix"); status = "needs_fix"; }
  if (blocking && status === "docs_pending") { assertTransition("docs_pending", "needs_fix"); status = "needs_fix"; }
  // No blocking problem: status stays; the application is now eligible for POST /submit (-> ready_for_review).

  await ctx.store.set(`applications/${appId}`, {
    ...app,
    status,
    mismatches,
    readiness: { score: readiness.score, items: readiness.items, quickApprove: readiness.quickApprove, eligible },
    metrics: { ...(app.metrics ?? {}), mistakesCaught: (app.metrics?.mistakesCaught ?? 0) + fresh },
    updatedAt: new Date().toISOString(),
  });
  await audit(ctx.store, user, "application.check", appId, { codes: mismatches.map((m) => m.code), score: readiness.score, eligible });
  if (status !== app.status) {
    await audit(ctx.store, user, `status.${status}`, appId, { from: app.status });
    if (status === "needs_fix" && app.status === "docs_pending") await ctx.notifier.notify(appId, { ...app, status }, "needs_fix");
  }
  return { status, eligible, mismatches, readiness: { score: readiness.score, quickApprove: readiness.quickApprove, items: readiness.items } };
}

const resolveBody = z.object({ use: z.enum(["answers", ...DOC_KINDS]) });

export const checkRouter = (ctx: Ctx) =>
  Router()
    /** POST /applications/:id/check */
    .post("/:id/check", async (req, res, next) => {
      try {
        const appId = String(req.params.id);
        const app = await loadOwnApp(ctx, req.user!, appId);
        res.json(await runCheck(ctx, req.user!, appId, app));
      } catch (e) { next(e); }
    })

    /**
     * POST /applications/:id/resolve-name {use}: the customer picks the correct spelling when their name is
     * spelled two ways ("answers" keeps what they said, or a document's spelling). Sets the form name, records the
     * choice (which silences the warning-level NAME_SPELLED_DIFFERENTLY) and re-runs the check.
     */
    .post("/:id/resolve-name", async (req, res, next) => {
      try {
        const appId = String(req.params.id);
        const { use } = resolveBody.parse(req.body);
        const app = await loadOwnApp(ctx, req.user!, appId);
        let answers = app.answers ?? {};
        if (use !== "answers") {
          const name = app.documents?.[use]?.fields?.name;
          if (typeof name !== "string" || !name.trim()) throw new AppError(409, "no_name", "That document has no readable name");
          answers = { ...answers, full_name: { value: name, valueEn: name, confidence: 1, confirmed: true, source: use } };
        }
        const next = { ...app, answers, nameResolved: { use, at: new Date().toISOString() } };
        await audit(ctx.store, req.user!, "name.resolve", appId, { use });
        res.json(await runCheck(ctx, req.user!, appId, next));
      } catch (e) { next(e); }
    });
