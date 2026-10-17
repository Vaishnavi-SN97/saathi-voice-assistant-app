import { Router } from "express";
import { z } from "zod";
import type { Ctx } from "../app.js";
import { audit } from "../audit.js";
import { requireRole } from "../auth.js";
import { AppError } from "../errors.js";
import { form } from "../form.js";
import { verifyQrToken } from "../services/qr.js";

const body = z.object({ token: z.string().min(20) });

const label = (id: string, v: unknown) => form.fields.find((f) => f.id === id)?.options?.find((o) => o.value === v)?.label.en ?? String(v ?? "");

/** POST /checkin/verify (banker): validates the QR and returns a summary. Does NOT consume it: signing does. */
export const checkinRouter = (ctx: Ctx) =>
  Router().post("/verify", requireRole("banker"), async (req, res, next) => {
    try {
      const { token } = body.parse(req.body);
      const { aid, jti } = verifyQrToken(ctx.env.QR_JWT_SECRET, token);
      const app = await ctx.store.get(`applications/${aid}`);
      if (!app || app.qr?.jti !== jti) throw new AppError(401, "qr_invalid", "Invalid QR code");
      if (app.qr.usedAt) {
        await audit(ctx.store, req.user!, "checkin.rejected", aid, { reason: "qr_used" });
        throw new AppError(409, "qr_used", "This QR code was already used");
      }
      if (app.status !== "approved") throw new AppError(409, "wrong_status", `Application is ${app.status}, not approved`);

      const a = app.answers ?? {};
      await audit(ctx.store, req.user!, "checkin.verify", aid, { jti });
      res.json({
        appId: aid,
        status: app.status,
        expiresAt: app.qr.expiresAt,
        summary: {
          name: a.full_name?.valueEn ?? a.full_name?.value,
          dob: a.dob?.value,
          mobile: a.mobile?.value,
          address: a.address?.valueEn ?? a.address?.value,
          occupation: label("occupation", a.occupation?.value),
          nomineeName: a.nominee_name?.valueEn ?? a.nominee_name?.value,
          nomineeRelation: label("nominee_relation", a.nominee_relation?.value),
          aadhaarLast4: app.documents?.aadhaar?.aadhaarLast4 ?? null,
          readinessScore: app.readiness?.score ?? null,
        },
        pdfUrl: `/files/${aid}/pdf`,
      });
    } catch (e) { next(e); }
  });
