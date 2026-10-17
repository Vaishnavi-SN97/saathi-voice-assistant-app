import { Router } from "express";
import { z } from "zod";
import type { Ctx } from "../app.js";
import { audit } from "../audit.js";
import { CODES, form, toLang } from "../form.js";
import { fieldOut } from "../services/interview-engine.js";

const createBody = z.object({
  language: z.string().transform((v, c) => toLang(v) ?? (c.addIssue({ code: "custom", message: "unsupported language" }), z.NEVER)),
  consent: z.literal(true),
});

export const applicationsRouter = (ctx: Ctx) =>
  Router().post("/", async (req, res, next) => {
    try {
      const { language: lang } = createBody.parse(req.body);
      const user = req.user!;
      const now = new Date().toISOString();

      // Shape follows SPEC "Application".
      const id = await ctx.store.add("applications", {
        customerUid: user.uid,
        language: CODES[lang],
        status: "draft",
        consent: { at: now, version: form.version },
        answers: {},
        documents: {},
        mismatches: [],
        readiness: { score: 0, items: [] },
        notify: { phone: null, consent: false },
        metrics: { startedAt: now, scamBlocks: 0, mistakesCaught: 0 },
        interview: { attempts: 0 },
        createdAt: now,
        updatedAt: now,
      });
      await audit(ctx.store, user, "application.create", id, { language: CODES[lang], anonymous: user.anonymous });
      await audit(ctx.store, user, "consent.given", id, { version: form.version });

      res.status(201).json({ id, status: "draft", question: await fieldOut(ctx, form.fields[0], lang) });
    } catch (e) { next(e); }
  });
