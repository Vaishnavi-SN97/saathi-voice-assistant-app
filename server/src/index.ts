import type { Express } from "express";

import { createApp } from "./app.js";
import { createDegradedApp } from "./degraded.js";
import { loadEnv } from "./env.js";
import { firebaseDeps } from "./firebase.js";
import { runRetention } from "./services/retention.js";

const env = loadEnv();

// A single stray rejection used to take the whole service down, which on Render reads as a
// routing failure rather than a crash. Log it and keep serving; real request errors are still
// handled by errorHandler.
process.on("unhandledRejection", (reason) => {
  console.error("unhandled rejection:", reason instanceof Error ? reason.message : reason);
});
process.on("uncaughtException", (error) => {
  console.error("uncaught exception:", error.message);
});

// Names only, never values: this line in the Render log says what is missing without leaking a key.
const missing = (
  [
    ["FIREBASE_CLIENT_EMAIL", env.FIREBASE_CLIENT_EMAIL],
    ["FIREBASE_PRIVATE_KEY", env.FIREBASE_PRIVATE_KEY],
    ["SARVAM_API_KEY", env.SARVAM_API_KEY],
    ["GEMINI_API_KEY", env.GEMINI_API_KEY],
  ] as const
)
  .filter(([, value]) => !value)
  .map(([name]) => name);

if (missing.length) {
  console.warn(`env not set: ${missing.join(", ")}`);
}

// Never run on a public address with the built-in development signing secret.
if (
  env.QR_JWT_SECRET === "dev-only-secret-change-me" &&
  !/localhost|127.0.0.1/.test(env.PUBLIC_API_URL)
) {
  console.error(
    "Refusing to start: set QR_JWT_SECRET (a long random value) when PUBLIC_API_URL is not localhost."
  );
  process.exit(1);
}

let app: Express;
let store: Awaited<ReturnType<typeof firebaseDeps>>["store"] | undefined;

try {
  const deps = firebaseDeps(env);
  store = deps.store;
  app = createApp({ env, ...deps });
} catch (e) {
  const reason = (e as Error).message;
  console.error(`Firebase Admin failed to start: ${reason}`);
  console.error("Serving /health only. Fix the Firebase service-account variables and redeploy.");
  app = createDegradedApp(env, reason);
}

const server = app.listen(env.PORT, "0.0.0.0", () => {
  console.log(
    `saathi server on :${env.PORT} (MOCK_AI=${env.MOCK_AI}, NOTIFY_MODE=${env.NOTIFY_MODE})`
  );
});

server.on("error", (e) => {
  console.error(`server could not listen on :${env.PORT}:`, (e as Error).message);
  process.exit(1);
});

// Retention cleanup
if (env.RETENTION === "on" && store) {
  const db = store;
  const run = () =>
    runRetention(db, { days: env.RETENTION_DAYS })
      .then(
        (r) =>
          (r.photosDeleted || r.applicationsDeleted) &&
          console.log(
            `retention: ${r.photosDeleted} photos, ${r.applicationsDeleted} applications deleted`
          )
      )
      .catch((e) =>
        console.error("retention failed:", (e as Error).message)
      );

  setTimeout(run, 30_000).unref();
  setInterval(run, 6 * 3600_000).unref();
}
