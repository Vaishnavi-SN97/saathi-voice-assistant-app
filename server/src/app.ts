import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import cors from "cors";
import express from "express";
import helmet from "helmet";

import { createAi, type Ai } from "./ai/index.js";
import { createExtractor, type Extractor } from "./services/gemini.js";
import { Notifier, type Sender } from "./services/notify.js";
import { requireAuth, type TokenVerifier } from "./auth.js";
import type { Env } from "./env.js";
import { errorHandler } from "./errors.js";
import { FileStore } from "./fileStore.js";
import { MediaStore, TtsCache } from "./mediaStore.js";

import { applicationsRouter } from "./routes/applications.js";
import { filesRouter } from "./routes/files.js";
import { checkinRouter } from "./routes/checkin.js";
import { checkRouter, documentsRouter } from "./routes/documents.js";
import { lifecycleRouter } from "./routes/lifecycle.js";
import { interviewRouter } from "./routes/interview.js";
import { mediaRouter } from "./routes/media.js";
import { metricsRouter } from "./routes/metrics.js";
import { ttsRouter, voiceRouter } from "./routes/voice.js";

import type { Store } from "./store.js";

export interface Deps {
  env: Env;
  store: Store;
  verifier: TokenVerifier;
  ai?: Ai;
  extractor?: Extractor;

  /** WhatsApp sender override (tests); defaults to Twilio when credentials exist. */
  sender?: Sender;
}

export interface Ctx {
  env: Env;
  notifier: Notifier;
  store: Store;
  files: FileStore;
  media: MediaStore;
  ai: Ai;
  extract: Extractor;
  ttsCache: TtsCache;
}

/**
 * Everything the routes (and the admin scripts) need,
 * built from the environment and store.
 */
export function createCtx({
  env,
  store,
  ai,
  extractor,
  sender,
}: Omit<Deps, "verifier">): Ctx {
  const media = new MediaStore(store, env.QR_JWT_SECRET);

  return {
    env,
    notifier: new Notifier(env, store, media, sender),
    store,
    files: new FileStore(store),
    media,
    ai: ai ?? createAi(env),
    extract: extractor ?? createExtractor(env),
    ttsCache: new TtsCache(media),
  };
}

/** Paths that belong to the API; everything else may be handed to the web app's router. */
const API_PREFIXES = [
  "/health",
  "/media",
  "/files",
  "/voice",
  "/tts",
  "/interview",
  "/checkin",
  "/metrics",
  "/documents",
  "/applications",
];

/** The built web app to serve, or null when this process is API-only. */
function webDistDir(env: Env): string | null {
  if (!env.SERVE_WEB) return null;
  const dir = env.WEB_DIST ?? fileURLToPath(new URL("../../web/dist/", import.meta.url));
  if (existsSync(join(dir, "index.html"))) return dir;
  console.warn(`SERVE_WEB is on but no build was found at ${dir} — run \`npm --prefix web run build\`. Serving the API only.`);
  return null;
}

export function createApp(deps: Deps) {
  const { env, verifier } = deps;

  const ctx = createCtx(deps);
  const webDist = webDistDir(env);

  const app = express();

  // --------------------------------------------------
  // SECURITY
  // --------------------------------------------------

  // Serving the web app from here means helmet's headers apply to the PAGE, not just to API
  // replies. Its default policy allows 'self' only, which would block Firebase sign-in and
  // Firestore, so the page gets a policy that names the Google endpoints the app really uses.
  app.use(
    helmet(
      webDist
        ? {
            contentSecurityPolicy: {
              directives: {
                defaultSrc: ["'self'"],
                baseUri: ["'self'"],
                formAction: ["'self'"],
                frameAncestors: ["'self'"],
                objectSrc: ["'none'"],
                scriptSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", "data:", "blob:"],
                mediaSrc: ["'self'", "data:", "blob:"],
                fontSrc: ["'self'", "data:"],
                workerSrc: ["'self'", "blob:"],
                connectSrc: [
                  "'self'",
                  "https://*.googleapis.com",
                  "https://*.firebaseio.com",
                  "wss://*.firebaseio.com",
                  "https://*.firebaseapp.com",
                ],
              },
            },
          }
        : undefined
    )
  );

  // --------------------------------------------------
  // CORS
  // --------------------------------------------------

  // A trailing slash makes an origin never match, which is the usual cause of a CORS failure
  // after someone pastes the site URL into CORS_ORIGINS, so normalise before comparing.
  const allowedOrigins = [
    ...new Set(
      [
        "https://saathi-voice-assistant-app.onrender.com",
        "http://localhost:5173",
        ...env.CORS_ORIGINS.split(","),
      ]
        .map((origin) => origin.trim().replace(/\/+$/, ""))
        .filter(Boolean)
    ),
  ];

  app.use(
    cors({
      origin: allowedOrigins,
      methods: [
        "GET",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
        "OPTIONS",
      ],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
      ],
      credentials: false,
    })
  );

  // --------------------------------------------------
  // JSON
  // --------------------------------------------------

  app.use(
    express.json({
      limit: env.JSON_LIMIT,
    })
  );

  // --------------------------------------------------
  // HEALTH CHECK
  // --------------------------------------------------

  app.get("/health", (_req, res) => {
    res.status(200).json({
      ok: true,
      mockAi: env.MOCK_AI,
    });
  });

  // A reachable root makes the deployment diagnosable: this answer proves the request reached
  // Express, so a 404 from Render's edge (x-render-routing: no-server) can never be mistaken
  // for an application-level 404 again. When the web app is served from here, "/" is the app
  // itself and this moves to /api.
  app.get(webDist ? "/api" : "/", (_req, res) => {
    res.status(200).json({
      ok: true,
      service: "saathi-api",
      health: "/health",
      web: Boolean(webDist),
    });
  });

  // --------------------------------------------------
  // PUBLIC MEDIA
  // --------------------------------------------------

  app.use("/media", mediaRouter(ctx));

  // --------------------------------------------------
  // AUTHENTICATED ROUTES
  // --------------------------------------------------

  const auth = requireAuth(verifier);

  app.use(
    "/files",
    auth,
    filesRouter(ctx)
  );

  app.use(
    "/voice",
    auth,
    voiceRouter(ctx)
  );

  app.use(
    "/tts",
    auth,
    ttsRouter(ctx)
  );

  app.use(
    "/interview",
    auth,
    interviewRouter(ctx)
  );

  app.use(
    "/checkin",
    auth,
    checkinRouter(ctx)
  );

  app.use(
    "/metrics",
    auth,
    metricsRouter(ctx)
  );

  app.use(
    "/documents",
    auth,
    documentsRouter(ctx)
  );

  app.use(
    "/applications",
    auth,
    checkRouter(ctx)
  );

  app.use(
    "/applications",
    auth,
    lifecycleRouter(ctx)
  );

  app.use(
    "/applications",
    auth,
    applicationsRouter(ctx)
  );

  // --------------------------------------------------
  // WEB APP (single-service deploy)
  // --------------------------------------------------

  if (webDist) {
    // Hashed assets are immutable; index.html must never be cached or a deploy keeps serving the old app.
    app.use(express.static(webDist, { index: false, maxAge: "1y", setHeaders: (res, path) => {
      if (path.endsWith(".html") || path.endsWith(".webmanifest")) res.setHeader("Cache-Control", "no-cache");
    } }));

    // Client-side routes (/bank, /status/...) are not files, so hand them the app shell. API paths
    // are excluded so a wrong endpoint still answers with the JSON 404 instead of HTML.
    app.get(/.*/, (req, res, next) => {
      if (API_PREFIXES.some((p) => req.path === p || req.path.startsWith(`${p}/`))) return next();
      res.setHeader("Cache-Control", "no-cache");
      res.sendFile(join(webDist, "index.html"), (e) => e && next());
    });
  }

  // --------------------------------------------------
  // 404
  // --------------------------------------------------

  app.use((_req, res) => {
    res.status(404).json({
      error: "Not found",
      code: "not_found",
    });
  });

  // --------------------------------------------------
  // ERROR HANDLER
  // --------------------------------------------------

  app.use(errorHandler);

  return app;
}