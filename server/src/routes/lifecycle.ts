import { Router } from "express";
import sharp from "sharp";
import { z } from "zod";
import type { Ctx } from "../app.js";
import { audit } from "../audit.js";
import { requireRole, type AuthUser } from "../auth.js";
import { AppError } from "../errors.js";
import { toLang } from "../form.js";
import { evaluate } from "../services/evaluate.js";
import { fillAccountForm } from "../services/pdf-fill.js";
import { issueQr, verifyQrToken } from "../services/qr.js";
import { ttsCached } from "../services/sarvam.js";
import { assertTransition } from "../status.js";

const SUBMITTABLE = ["docs_pending", "needs_fix"];
type Actor = AuthUser | "system";
const actorId = (a: Actor) => (a === "system" ? "system" : a.uid);

async function loadApp(ctx: Ctx, appId: string) {
  const app = await ctx.store.get(`applications/${appId}`);
  if (!app) throw new AppError(404, "not_found", "Application not found");
  return app;
}

/** (Re)builds the PDF from the application (plus the signature once signed) and saves it as the "pdf" file. */
export async function buildPdf(ctx: Ctx, appId: string, app: Record<string, any>) {
  let signaturePng: Buffer | undefined;
  if (app.status === "signed") {
    const sig = await ctx.files.get(appId, "signature");
    if (sig) signaturePng = await sharp(sig.data).png().toBuffer();
  }
  const pdf = await fillAccountForm(appId, app, { signaturePng });
  const saved = await ctx.files.put(appId, "pdf", pdf, "application/pdf");
  return { size: saved.size, url: `/files/${appId}/pdf` };
}

/* ---------- banker decisions (also used by scripts/decide.ts) ---------- */

/** ready_for_review -> approved: issues the JWT QR, stores its jti, notifies. */
export async function approveApplication(ctx: Ctx, actor: Actor, id: string, app: Record<string, any>, note?: string) {
  if (app.status !== "ready_for_review") throw new AppError(409, "wrong_status", `Cannot review while ${app.status}`);
  assertTransition("ready_for_review", "approved");
  const now = new Date().toISOString();
  const qr = await issueQr(ctx.env.QR_JWT_SECRET, id);
  const mediaId = await ctx.media.put(qr.png, "image/png", `qr-${qr.jti}`);
  // `token` is kept so the customer app can show the QR; jti/expiresAt/usedAt follow SPEC.
  const next = {
    ...app,
    status: "approved",
    review: { decision: "approved", note: note ?? null, at: now, by: actorId(actor) },
    qr: { jti: qr.jti, expiresAt: qr.expiresAt, usedAt: null, token: qr.token },
    metrics: { ...(app.metrics ?? {}), approvedAt: now },
    updatedAt: now,
  };
  await ctx.store.set(`applications/${id}`, next);
  await audit(ctx.store, actor, "review.approve", id, { jti: qr.jti });
  await ctx.notifier.notify(id, next, "approved", { mediaId });
  return { status: "approved", qr: { jti: qr.jti, expiresAt: qr.expiresAt, imageUrl: ctx.media.url(mediaId) } };
}

/** ready_for_review -> sent_back: English note -> Sarvam translate -> mp3 -> WhatsApp. */
export async function sendBackApplication(ctx: Ctx, actor: Actor, id: string, app: Record<string, any>, note: string) {
  if (app.status !== "ready_for_review") throw new AppError(409, "wrong_status", `Cannot review while ${app.status}`);
  assertTransition("ready_for_review", "sent_back");
  const lang = toLang(app.language) ?? "en";
  const noteTranslated = lang === "en" ? note : await ctx.ai.translate(note, lang);
  const mediaId = await ttsCached(ctx.ai, ctx.ttsCache, noteTranslated, lang);
  const now = new Date().toISOString();
  const next = {
    ...app,
    status: "sent_back",
    review: { decision: "sent_back", note, noteTranslated, at: now, by: actorId(actor) },
    updatedAt: now,
  };
  await ctx.store.set(`applications/${id}`, next);
  await audit(ctx.store, actor, "review.send_back", id, {});
  await ctx.notifier.notify(id, next, "sent_back", { note: noteTranslated, mediaId });
  return { status: "sent_back", noteTranslated, audioUrl: ctx.media.url(mediaId) };
}

/** approved -> signed: stores the signature, marks the QR used, re-issues the PDF with the signature. Caller verifies the QR. */
export async function signApplication(ctx: Ctx, actor: Actor, id: string, app: Record<string, any>, signaturePng: Buffer) {
  if (app.status !== "approved") throw new AppError(409, "wrong_status", `Cannot sign while ${app.status}`);
  assertTransition("approved", "signed");
  const now = new Date().toISOString();
  await ctx.files.put(id, "signature", signaturePng, "image/png");
  const next = {
    ...app,
    status: "signed",
    qr: { ...app.qr, usedAt: now },
    metrics: { ...(app.metrics ?? {}), signedAt: now },
    updatedAt: now,
  };
  await ctx.store.set(`applications/${id}`, next);
  await buildPdf(ctx, id, next); // PDF now carries the signature
  await audit(ctx.store, actor, "application.sign", id, { jti: app.qr?.jti });
  await ctx.notifier.notify(id, next, "signed");
  return { status: "signed", signedAt: now, pdfUrl: `/files/${id}/pdf` };
}

/* ---------- routes ---------- */

const reviewBody = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("approve"), note: z.string().max(500).optional() }),
  z.object({ decision: z.literal("send_back"), note: z.string().trim().min(3).max(500) }),
]);
const signBody = z.object({
  token: z.string().min(20),
  signature: z.string().regex(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/).max(1_500_000),
});
const consentBody = z.object({ consent: z.boolean() });

export const lifecycleRouter = (ctx: Ctx) =>
  Router()
    // Generate / refresh the PDF (customer who owns the application, or a banker).
    .post("/:id/pdf", async (req, res, next) => {
      try {
        const id = String(req.params.id), u = req.user!;
        const app = await loadApp(ctx, id);
        if (u.role !== "banker" && app.customerUid !== u.uid) throw new AppError(403, "forbidden", "Not your application");
        if (app.status === "draft") throw new AppError(409, "wrong_status", "Finish the interview first");
        const out = await buildPdf(ctx, id, app);
        await audit(ctx.store, u, "pdf.generate", id, { size: out.size });
        res.json(out);
      } catch (e) { next(e); }
    })

    // Customer sends the application to the bank: -> ready_for_review
    .post("/:id/submit", async (req, res, next) => {
      try {
        const id = String(req.params.id), u = req.user!;
        const app = await loadApp(ctx, id);
        if (app.customerUid !== u.uid) throw new AppError(403, "forbidden", "Not your application");
        if (!SUBMITTABLE.includes(app.status)) throw new AppError(409, "wrong_status", `Cannot submit while ${app.status}`);

        const ev = evaluate(app);
        if (!ev.eligible) {
          return void res.status(409).json({ error: "Please fix the listed problems first", code: "not_eligible", mismatches: ev.mismatches, readiness: ev.readiness });
        }
        assertTransition(app.status, "ready_for_review");
        const now = new Date().toISOString();
        const next = {
          ...app,
          status: "ready_for_review",
          mismatches: ev.mismatches,
          readiness: { score: ev.readiness.score, items: ev.readiness.items, quickApprove: ev.readiness.quickApprove, eligible: true },
          metrics: { ...(app.metrics ?? {}), readyAt: now },
          updatedAt: now,
        };
        await ctx.store.set(`applications/${id}`, next);
        await buildPdf(ctx, id, next);
        await audit(ctx.store, u, "application.submit", id, { from: app.status, score: ev.readiness.score });
        await ctx.notifier.notify(id, next, "ready_for_review");
        res.json({ status: "ready_for_review", readiness: next.readiness });
      } catch (e) { next(e); }
    })

    // Customer turns WhatsApp updates on or off (the status screen toggle)
    .post("/:id/notify-consent", async (req, res, next) => {
      try {
        const id = String(req.params.id), u = req.user!;
        const { consent } = consentBody.parse(req.body);
        const app = await loadApp(ctx, id);
        if (app.customerUid !== u.uid) throw new AppError(403, "forbidden", "Not your application");
        if (app.status === "draft") throw new AppError(409, "wrong_status", "Finish the interview first");
        await ctx.store.set(`applications/${id}`, { ...app, notify: { ...(app.notify ?? {}), consent }, updatedAt: new Date().toISOString() });
        await audit(ctx.store, u, "notify.consent", id, { consent });
        res.json({ consent });
      } catch (e) { next(e); }
    })

    // Banker decision
    .post("/:id/review", requireRole("banker"), async (req, res, next) => {
      try {
        const id = String(req.params.id), u = req.user!;
        const body = reviewBody.parse(req.body);
        const app = await loadApp(ctx, id);
        res.json(body.decision === "approve" ? await approveApplication(ctx, u, id, app, body.note) : await sendBackApplication(ctx, u, id, app, body.note));
      } catch (e) { next(e); }
    })

    // Branch: customer signs on the banker's device. Consumes the QR (jti).
    .post("/:id/sign", requireRole("banker"), async (req, res, next) => {
      try {
        const id = String(req.params.id), u = req.user!;
        const body = signBody.parse(req.body);
        const { aid, jti } = verifyQrToken(ctx.env.QR_JWT_SECRET, body.token);
        if (aid !== id) throw new AppError(401, "qr_invalid", "This QR code belongs to another application");
        const app = await loadApp(ctx, id);
        if (app.qr?.jti !== jti) throw new AppError(401, "qr_invalid", "Invalid QR code");
        if (app.qr.usedAt) throw new AppError(409, "qr_used", "This QR code was already used");
        if (app.status !== "approved") throw new AppError(409, "wrong_status", `Cannot sign while ${app.status}`);

        let sigPng: Buffer;
        try {
          sigPng = await sharp(Buffer.from(body.signature.split(",")[1], "base64")).flatten({ background: "#ffffff" }).png().toBuffer();
        } catch { throw new AppError(400, "bad_signature", "Could not read the signature image"); }

        res.json(await signApplication(ctx, u, id, app, sigPng));
      } catch (e) { next(e); }
    });
