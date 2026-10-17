import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import type { Ctx } from "../app.js";
import { audit } from "../audit.js";
import { AppError } from "../errors.js";
import { LANGS } from "../form.js";
import { toWav16kMono } from "../services/audio-convert.js";
import { SHIELD_WARNING, scanText } from "../services/scam-shield.js";
import { ttsCached } from "../services/sarvam.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

const sttBody = z.object({ language: z.enum(LANGS).optional(), appId: z.string().optional() });
const ttsBody = z.object({
  text: z.string().min(1).max(600),
  language: z.enum(LANGS),
  pace: z.number().min(0.5).max(1.5).default(1),
});

export const voiceRouter = ({ ai, store }: Ctx) =>
  Router().post("/stt", upload.single("audio"), async (req, res, next) => {
    try {
      if (!req.file) throw new AppError(400, "no_audio", "Missing 'audio' file");
      const { language, appId } = sttBody.parse(req.body);
      const wav = await toWav16kMono(req.file.buffer);
      const transcript = await ai.stt(wav, language);
      const shield = scanText(transcript);
      if (shield.level !== "none") {
        await audit(store, req.user!, `scam_shield.${shield.level}`, appId, { reasons: shield.reasons });
      }
      // On "block" the raw transcript is never returned or stored; only the redacted text.
      res.json({
        transcript: shield.text,
        flagged: shield.flagged,
        level: shield.level,
        reasons: shield.reasons,
        warning: shield.flagged ? SHIELD_WARNING[language ?? "en"] : undefined,
      });
    } catch (e) { next(e); }
  });

export const ttsRouter = ({ ai, media, ttsCache }: Ctx) =>
  Router().post("/", async (req, res, next) => {
    try {
      const { text, language, pace } = ttsBody.parse(req.body);
      const id = await ttsCached(ai, ttsCache, text, language, pace);
      res.json({ mediaId: id, audioUrl: media.url(id) });
    } catch (e) { next(e); }
  });
