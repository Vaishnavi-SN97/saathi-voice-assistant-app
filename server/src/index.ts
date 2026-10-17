import { createApp } from "./app.js";
import { loadEnv } from "./env.js";
import { firebaseDeps } from "./firebase.js";
import { runRetention } from "./services/retention.js";

const env = loadEnv();

// Never run on a public address with the built-in development signing secret (QR codes and audio links would be forgeable).
if (env.QR_JWT_SECRET === "dev-only-secret-change-me" && !/localhost|127.0.0.1/.test(env.PUBLIC_API_URL)) {
  console.error("Refusing to start: set QR_JWT_SECRET (a long random value) when PUBLIC_API_URL is not localhost.");
  process.exit(1);
}
const deps = firebaseDeps(env);
const app = createApp({ env, ...deps });
app.listen(env.PORT, "0.0.0.0", () => {
  console.log(
    `saathi server on :${env.PORT} (MOCK_AI=${env.MOCK_AI}, NOTIFY_MODE=${env.NOTIFY_MODE})`
  );
});

// Retention cleanup (ID photos after signing, abandoned applications): once after start-up, then every 6 hours.
if (env.RETENTION === "on") {
  const run = () =>
    runRetention(deps.store, { days: env.RETENTION_DAYS })
      .then((r) => (r.photosDeleted || r.applicationsDeleted) && console.log(`retention: ${r.photosDeleted} photos, ${r.applicationsDeleted} applications deleted`))
      .catch((e) => console.error("retention failed:", (e as Error).message));
  setTimeout(run, 30_000).unref();
  setInterval(run, 6 * 3600_000).unref();
}
