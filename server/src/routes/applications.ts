import { Router } from "express";
import { z } from "zod";
import type { Ctx } from "../app.js";
import { audit } from "../audit.js";
import { form, LANGS, type Lang } from "../form.js";
import { ttsCached } from "../services/sarvam.js";

const createBody = z.object({
  language: z.enum(LANGS),
  consent: z.literal(true),
});

export const applicationsRouter = ({ store, media, ai, ttsCache }: Ctx) =>
  Router().post("/", async (req, res, next) => {
    try {
      const { language: lang } = createBody.parse(req.body) as { language: Lang };
      const user = req.user!;
      const q = form.questions[0];
      const now = new Date().toISOString();

      const id = await store.add("applications", {
        ownerUid: user.uid,
        language: lang,
        status: "draft",
        consent: { given: true, at: now, formVersion: form.version, text: form.consent[lang] },
        currentQuestion: q.id,
        answers: {},
        interview: { state: "asking", pending: null, attempts: 0 },
        createdAt: now,
        updatedAt: now,
      });
      await audit(store, user, "application.create", id, { language: lang, anonymous: user.anonymous });
      await audit(store, user, "consent.given", id, { formVersion: form.version });

      const text = q.prompt[lang];
      const audioId = await ttsCached(ai, ttsCache, text, lang);
      res.status(201).json({
        id,
        status: "draft",
        question: { id: q.id, type: q.type, prompt: text, audioUrl: media.url(audioId) },
      });
    } catch (e) { next(e); }
  });
