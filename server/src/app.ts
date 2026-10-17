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

/** Everything the routes (and the admin scripts) need, built from the env and a store. */
export function createCtx({ env, store, ai, extractor, sender }: Omit<Deps, "verifier">): Ctx {
  const media = new MediaStore(store, env.QR_JWT_SECRET);
  return { env, notifier: new Notifier(env, store, media, sender), store, files: new FileStore(store), media, ai: ai ?? createAi(env), extract: extractor ?? createExtractor(env), ttsCache: new TtsCache(media) };
}

export function createApp(deps: Deps) {
  const { env, verifier } = deps;
  const ctx = createCtx(deps);

  const app = express();
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean) }));
  app.use(express.json({ limit: env.JSON_LIMIT }));

  app.get("/health", (_req, res) => void res.json({ ok: true }));
  app.use("/media", mediaRouter(ctx));
  const auth = requireAuth(verifier);
  app.use("/files", auth, filesRouter(ctx));
  app.use("/voice", auth, voiceRouter(ctx));
  app.use("/tts", auth, ttsRouter(ctx));
  app.use("/interview", auth, interviewRouter(ctx));
  app.use("/checkin", auth, checkinRouter(ctx));
  app.use("/metrics", auth, metricsRouter(ctx));
  app.use("/documents", auth, documentsRouter(ctx));
  app.use("/applications", auth, checkRouter(ctx));
  app.use("/applications", auth, lifecycleRouter(ctx));
  app.use("/applications", auth, applicationsRouter(ctx));

  app.use((_req, res) => void res.status(404).json({ error: "Not found", code: "not_found" }));
  app.use(errorHandler);
  return app;
}
