import cors from "cors";
import express from "express";
import helmet from "helmet";

import type { Env } from "./env.js";

/**
 * The app served when Firebase Admin cannot start (bad or missing service-account credentials).
 *
 * Without this the process exits at boot, Render's deploy fails, and the hostname answers
 * `Not Found` with `x-render-routing: no-server` — a dead service that looks like a routing bug.
 * Staying up keeps the health check green and makes the real reason readable over HTTP, while every
 * real route refuses with 503 rather than pretending to work. Authentication is never bypassed here:
 * the routes that need a verified token are simply unavailable.
 */
export function createDegradedApp(env: Env, reason: string) {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: true, methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"] }));

  app.get("/health", (_req, res) => {
    res.status(200).json({ ok: true, mockAi: env.MOCK_AI });
  });

  app.get("/", (_req, res) => {
    res.status(200).json({
      ok: true,
      service: "saathi-api",
      degraded: true,
      // `reason` is our own message about which variable is missing or malformed, never a value.
      reason,
    });
  });

  app.use((_req, res) => {
    res.status(503).json({
      error: "Firebase Admin is not configured on this server",
      code: "firebase_unavailable",
      reason,
    });
  });

  return app;
}
