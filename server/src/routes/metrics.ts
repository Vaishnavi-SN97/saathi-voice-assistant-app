import { Router } from "express";
import type { Ctx } from "../app.js";
import { requireRole } from "../auth.js";
import { computeMetrics } from "../services/metrics.js";

/** GET /metrics (banker). ?demo=exclude leaves seeded demo rows out of the numbers. */
export const metricsRouter = (ctx: Ctx) =>
  Router().get("/", requireRole("banker"), async (req, res, next) => {
    try {
      const docs = await ctx.store.list("applications");
      res.json(computeMetrics(docs.map((d) => d.data), { baselineMinutes: ctx.env.BASELINE_MANUAL_MINUTES, excludeDemo: req.query.demo === "exclude" }));
    } catch (e) { next(e); }
  });
