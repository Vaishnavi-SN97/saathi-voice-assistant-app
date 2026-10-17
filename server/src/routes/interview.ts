import { Router } from "express";
import { z } from "zod";
import type { Ctx } from "../app.js";
import { handleAnswer, handleConfirm } from "../services/interview-engine.js";

const answerBody = z.object({
  appId: z.string().min(1),
  text: z.string().min(1).max(500),
  source: z.enum(["voice", "typed"]).default("voice"),
});
const confirmBody = z
  .object({ appId: z.string().min(1), text: z.string().max(200).optional(), confirmed: z.boolean().optional() })
  .refine((b) => b.text !== undefined || b.confirmed !== undefined, "text or confirmed required");

export const interviewRouter = (ctx: Ctx) =>
  Router()
    .post("/answer", async (req, res, next) => {
      try {
        const b = answerBody.parse(req.body);
        res.json(await handleAnswer(ctx, req.user!, b.appId, b.text, b.source));
      } catch (e) { next(e); }
    })
    .post("/confirm", async (req, res, next) => {
      try {
        const b = confirmBody.parse(req.body);
        res.json(await handleConfirm(ctx, req.user!, b.appId, b));
      } catch (e) { next(e); }
    });
