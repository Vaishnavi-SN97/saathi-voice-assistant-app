import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import type { Ctx } from "../app.js";
import { AppError } from "../errors.js";
import { toLang, type Lang } from "../form.js";
import { registerScamBlock, speak } from "../services/interview-engine.js";
import { toWav16kMono } from "../services/audio-convert.js";
import { ttsCached } from "../services/sarvam.js";
import { SHIELD_WARNING, scanText } from "../services/scam-shield.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

const langField = z.string().optional().transform((v, c) => {
  if (v === undefined || v === "") return undefined;
  return toLang(v) ?? (c.addIssue({ code: "custom", message: "unsupported language" }), z.NEVER);
});
const sttBody = z.object({ language: langField, appId: z.string().optional() });
const ttsBody = z.object({
  text: z.string().min(1).max(600),
  language: z.string().transform((v, c) => toLang(v) ?? (c.addIssue({ code: "custom", message: "unsupported language" }), z.NEVER)),
  pace: z.number().min(0.5).max(1.5).default(1),
});

export const voiceRouter = (ctx: Ctx) =>
  Router().post("/stt", upload.single("audio"), async (req, res, next) => {
    try {
      if (!req.file) throw new AppError(400, "no_audio", "Missing 'audio' file");
      const body = sttBody.parse(req.body);
      const lang: Lang | undefined = body.language;
      const wav = await toWav16kMono(req.file.buffer);
      const transcript = await ctx.ai.stt(wav, lang);
      const shield = scanText(transcript);
      if (shield.flagged) {
        // SPEC: blocked -> store nothing, scamBlocks++, audit without content, return warning audio. The transcript is never returned.
        const block = body.appId
          ? await registerScamBlock(ctx, req.user!, body.appId, lang ?? "en", shield.reasons)
          : { blocked: true as const, warning: await speak(ctx, SHIELD_WARNING[lang ?? "en"], lang ?? "en") };
        return void res.json({ transcript: "", ...block, reasons: shield.reasons });
      }
      res.json({ transcript, blocked: false });
    } catch (e) { next(e); }
  });

export const ttsRouter = (ctx: Ctx) =>
  Router().post("/", async (req, res, next) => {
    try {
      const { text, language, pace } = ttsBody.parse(req.body);
      const id = await ttsCached(ctx.ai, ctx.ttsCache, text, language, pace);
      res.json({ mediaId: id, audioUrl: ctx.media.url(id) });
    } catch (e) { next(e); }
  });
