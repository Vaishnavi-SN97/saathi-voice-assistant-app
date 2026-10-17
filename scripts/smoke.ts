// End-to-end smoke test against a RUNNING server: one PASS/FAIL line per step, nothing secret printed.
//   npm run smoke                      -> http://localhost:<server PORT>
//   npm run smoke -- --url http://...  -> another API
//
// It needs server/.env (Firebase Admin) and web/.env (VITE_FIREBASE_API_KEY) so it can mint real ID tokens:
// a temporary customer and a temporary banker (role=banker claim) are created, used, and deleted again.
// Everything it writes (one application, its files and audit) is deleted at the end.
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DOCS = join(ROOT, "server", "assets", "demo-docs", "clean");

const { loadEnv } = await import("../server/src/env.js");
const { firebaseDeps } = await import("../server/src/firebase.js");
const { deleteApplication } = await import("../server/src/services/retention.js");

/* ---------- small helpers ---------- */

const envFile = (file: string) => {
  const out = new Map<string, string>();
  if (!existsSync(file)) return out;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (m && !out.has(m[1])) out.set(m[1], m[2].trim().replace(/^["']|["']$/g, ""));
  }
  return out;
};

class StepError extends Error {}
const must: (cond: unknown, msg: string) => asserts cond = (cond, msg) => { if (!cond) throw new StepError(msg); };
const short = (v: unknown) => JSON.stringify(v).slice(0, 150);
/** A 502 from our server means the AI provider refused (quota or outage), not a wiring problem: say so. */
const why = (status: number, body: any) =>
  status === 502 && body?.code === "upstream_error"
    ? "the AI provider refused the call (quota or outage) - wiring is fine; check the server log, set GEMINI_API_KEY_BACKUP, or use MOCK_AI=true"
    : short(body);

const results: { name: string; ok: boolean; info: string }[] = [];
async function step<T>(name: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    const value = await fn();
    results.push({ name, ok: true, info: typeof value === "string" ? value : "" });
    return value as T;
  } catch (e) {
    results.push({ name, ok: false, info: (e as Error).message });
    return null;
  }
}

/* ---------- setup ---------- */

const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : undefined; };
const serverEnv = envFile(join(ROOT, "server", ".env"));
const webEnv = envFile(join(ROOT, "web", ".env"));
const BASE = (arg("url") ?? process.env.API_URL ?? `http://localhost:${serverEnv.get("PORT") ?? 8080}`).replace(/\/$/, "");
const webKey = process.env.FIREBASE_WEB_API_KEY ?? webEnv.get("VITE_FIREBASE_API_KEY");
const projectId = serverEnv.get("FIREBASE_PROJECT_ID") ?? webEnv.get("VITE_FIREBASE_PROJECT_ID") ?? "saathi-f5b30";

// The script runs from the repo root, so server/.env is not loaded automatically: do it here (own values win).
for (const [k, v] of serverEnv) process.env[k] ??= v;

const env = loadEnv();
const { store, auth } = firebaseDeps(env);

/** Admin custom token -> real ID token (works whether or not Anonymous sign-in is enabled). */
async function idTokenFor(uid: string, claims?: Record<string, unknown>) {
  must(webKey, "no Firebase web API key (web/.env VITE_FIREBASE_API_KEY or FIREBASE_WEB_API_KEY)");
  const customToken = await auth.createCustomToken(uid, claims);
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${webKey}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  });
  const j = (await r.json()) as { idToken?: string; error?: { message?: string } };
  must(r.ok && j.idToken, `Firebase sign-in failed: ${j.error?.message ?? r.status}`);
  return j.idToken!;
}

const stamp = Date.now().toString(36);
const CUSTOMER_UID = `smoke-customer-${stamp}`;
const BANKER_UID = `smoke-banker-${stamp}`;
let appId = "";
let customerToken = "";
let bankerToken = "";

const call = async (token: string, method: string, path: string, body?: unknown) => {
  const r = await fetch(BASE + path, {
    method,
    headers: { authorization: `Bearer ${token}`, ...(body === undefined ? {} : { "content-type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const ct = r.headers.get("content-type") ?? "";
  return { status: r.status, body: ct.includes("json") ? ((await r.json()) as any) : Buffer.from(await r.arrayBuffer()) };
};
const upload = async (kind: string, file: string) => {
  const fd = new FormData();
  fd.append("appId", appId);
  fd.append("kind", kind);
  fd.append("image", new Blob([readFileSync(join(DOCS, file))], { type: "image/jpeg" }), file);
  const r = await fetch(`${BASE}/documents/extract`, { method: "POST", headers: { authorization: `Bearer ${customerToken}` }, body: fd });
  return { status: r.status, body: (await r.json()) as any };
};

/* ---------- the journey ---------- */

let mockAi: boolean | undefined;

await step("GET /health", async () => {
  let r: Response;
  try { r = await fetch(`${BASE}/health`); } catch { throw new StepError(`cannot reach ${BASE} (is the server running? npm run dev)`); }
  const j = (await r.json()) as { ok?: boolean; mockAi?: boolean };
  must(r.ok && j.ok === true, `unexpected answer ${short(j)}`);
  mockAi = j.mockAi;
  return `AI: ${j.mockAi ? "MOCK_AI=true" : "real Sarvam + Gemini"}`;
});

await step("anonymous customer session (Bearer token)", async () => {
  must((await fetch(`${BASE}/applications`, { method: "POST" })).status === 401, "a call without a token was not refused with 401");
  customerToken = await idTokenFor(CUSTOMER_UID);
  return `uid ${CUSTOMER_UID}`;
});

await step("POST /applications (create, first question + audio)", async () => {
  must(customerToken, "no customer token");
  const r = await call(customerToken, "POST", "/applications", { language: "hi-IN", consent: true });
  must(r.status === 201, `-> ${r.status} ${short(r.body)}`);
  must(r.body.question?.id === "full_name" && r.body.question?.audioUrl, `first question missing: ${short(r.body.question)}`);
  appId = r.body.id;
  const audio = await fetch(BASE + r.body.question.audioUrl); // token in the URL, no Bearer
  must(audio.ok && (audio.headers.get("content-type") ?? "").startsWith("audio/"), `question audio did not load (${audio.status})`);
  return `id ${appId.slice(0, 6)}…, audio ok`;
});

await step("POST /interview/answer + /confirm (8 fields)", async () => {
  must(appId, "no application");
  const answers = ["Ramesh Shetty", "15/03/1950", "9876543210", "12 MG Road, Bengaluru", "retired", "Sita Shetty", "spouse", "no"]; // "no" to WhatsApp: a test run must never message a real number
  for (const [i, text] of answers.entries()) {
    const a = await call(customerToken, "POST", "/interview/answer", { appId, text, source: "typed" });
    must(a.status === 200, `answer ${i + 1} -> ${a.status} ${short(a.body)}`);
    must(a.body.state === "confirming", `answer ${i + 1} was not understood: ${short(a.body)}`);
    must(a.body.readback?.audioUrl && a.body.display !== undefined, `read-back incomplete: ${short(a.body)}`);
    const c = await call(customerToken, "POST", "/interview/confirm", { appId, confirmed: true });
    must(c.status === 200, `confirm ${i + 1} -> ${c.status} ${short(c.body)}`);
  }
  const blocked = await call(customerToken, "POST", "/interview/answer", { appId, text: "my OTP is 4 8 2 9 1 7", source: "typed" });
  must(blocked.status < 500, `the scam shield caused a server error (${blocked.status})`);
  return "all 8 confirmed, scam line did not crash";
});

await step("POST /documents/extract (3 demo documents)", async () => {
  for (const kind of ["aadhaar", "pan", "passbook"]) {
    const r = await upload(kind, `${kind}.jpg`);
    must(r.status === 200, `${kind} -> ${r.status} ${why(r.status, r.body)}`);
    must(r.body.valid && !r.body.blurry, `${kind} judged ${r.body.blurry ? "blurry" : "invalid"}: ${short(r.body.fields)}`);
  }
  return "aadhaar, pan, passbook read and valid";
});

await step("POST /applications/:id/check (readiness)", async () => {
  const r = await call(customerToken, "POST", `/applications/${appId}/check`, {});
  must(r.status === 200, `-> ${r.status} ${short(r.body)}`);
  must(r.body.eligible === true, `not eligible, problems: ${short((r.body.mismatches ?? []).map((m: any) => m.code))}`);
  must(typeof r.body.readiness?.score === "number", `no readiness score: ${short(r.body.readiness)}`);
  return `score ${r.body.readiness.score}, no blocking problems`;
});

await step("POST /tts -> /voice/stt (mic upload, converted to 16 kHz WAV)", async () => {
  const tts = await call(customerToken, "POST", "/tts", { text: "नमस्ते", language: "hi-IN", pace: 0.75 });
  must(tts.status === 200 && tts.body.audioUrl, `/tts -> ${tts.status} ${short(tts.body)}`);
  const audio = await fetch(BASE + tts.body.audioUrl);
  must(audio.ok, `the audio link did not load (${audio.status})`);
  const bytes = Buffer.from(await audio.arrayBuffer());
  // sent the way a phone sends it (iPhone Safari says audio/mp4, Android audio/webm): the server converts it
  const fd = new FormData();
  fd.append("audio", new Blob([bytes], { type: "audio/webm" }), "answer.webm");
  fd.append("language", "hi");
  fd.append("appId", appId);
  const stt = await fetch(`${BASE}/voice/stt`, { method: "POST", headers: { authorization: `Bearer ${customerToken}` }, body: fd });
  const j = (await stt.json()) as any;
  must(stt.status === 200, `/voice/stt -> ${stt.status} ${short(j)}`);
  must(typeof j.transcript === "string" && j.blocked === false, `unexpected transcript: ${short(j)}`);
  return `${Math.round(bytes.length / 1024)} KB upload transcribed`;
});

await step("POST /resolve-name and /notify-consent", async () => {
  const rn = await call(customerToken, "POST", `/applications/${appId}/resolve-name`, { use: "answers" });
  must(rn.status === 200 && typeof rn.body.readiness?.score === "number", `/resolve-name -> ${rn.status} ${short(rn.body)}`);
  const off = await call(customerToken, "POST", `/applications/${appId}/notify-consent`, { consent: false });
  must(off.status === 200 && off.body.consent === false, `/notify-consent -> ${off.status} ${short(off.body)}`);
  const on = await call(customerToken, "POST", `/applications/${appId}/notify-consent`, { consent: true });
  must(on.status === 200 && on.body.consent === true, `/notify-consent (on) -> ${on.status} ${short(on.body)}`);
  return "name choice saved, WhatsApp toggle works both ways";
});

await step("POST /applications/:id/pdf", async () => {
  const r = await call(customerToken, "POST", `/applications/${appId}/pdf`, {});
  must(r.status === 200 && r.body.url, `-> ${r.status} ${short(r.body)}`);
  const file = await call(customerToken, "GET", `/files/${appId}/pdf`);
  must(file.status === 200 && Buffer.isBuffer(file.body) && file.body.subarray(0, 4).toString() === "%PDF", "the stored file is not a PDF");
  return `${Math.round(r.body.size / 1024)} KB, downloads through /files`;
});

await step("POST /applications/:id/submit", async () => {
  const r = await call(customerToken, "POST", `/applications/${appId}/submit`, {});
  must(r.status === 200 && r.body.status === "ready_for_review", `-> ${r.status} ${short(r.body)}`);
  return "ready_for_review";
});

await step("banker sign-in (role=banker claim)", async () => {
  bankerToken = await idTokenFor(BANKER_UID, { role: "banker" });
  const denied = await call(customerToken, "GET", "/metrics");
  must(denied.status === 403, `a customer was not refused on a banker route (${denied.status})`);
  return `uid ${BANKER_UID}`;
});

await step("bank queue (Firestore read as banker)", async () => {
  must(bankerToken, "no banker token");
  const r = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/applications?pageSize=300`, {
    headers: { authorization: `Bearer ${bankerToken}` },
  });
  const j = (await r.json()) as { documents?: { name: string }[]; error?: { message?: string } };
  must(r.ok, `Firestore refused the read: ${j.error?.message ?? r.status} (are the rules deployed? npx firebase-tools deploy --only firestore:rules)`);
  const ids = (j.documents ?? []).map((d) => d.name.split("/").pop());
  must(ids.includes(appId), "the new application is not in the queue");
  const photo = await call(bankerToken, "GET", `/files/${appId}/aadhaar`);
  must(photo.status === 200 && Buffer.isBuffer(photo.body) && photo.body.length > 1000, `the Aadhaar photo did not load for the banker (${photo.status})`);
  const m = await call(bankerToken, "GET", "/metrics");
  must(m.status === 200 && typeof m.body.tiles?.applicationsToday === "number", `GET /metrics -> ${m.status} ${short(m.body)}`);
  return `${ids.length} applications visible, photo + /metrics ok`;
});

await step("POST /applications/:id/review (approve, QR issued)", async () => {
  const denied = await call(customerToken, "POST", `/applications/${appId}/review`, { decision: "approve" });
  must(denied.status === 403, `a customer was allowed to review (${denied.status})`);
  const r = await call(bankerToken, "POST", `/applications/${appId}/review`, { decision: "approve", note: "smoke test" });
  must(r.status === 200 && r.body.status === "approved", `-> ${r.status} ${short(r.body)}`);
  must(r.body.qr?.jti && r.body.qr?.imageUrl, `no QR issued: ${short(r.body.qr)}`);
  const png = await fetch(BASE + r.body.qr.imageUrl);
  must(png.ok && (png.headers.get("content-type") ?? "").startsWith("image/"), `the QR image did not load (${png.status})`);
  return "approved, QR image loads";
});

await step("POST /checkin/verify (QR token, single use)", async () => {
  const doc = await store.get(`applications/${appId}`);
  const token = doc?.qr?.token as string | undefined;
  must(token, "the application has no QR token");
  const bad = await call(bankerToken, "POST", "/checkin/verify", { token: `${token.slice(0, -2)}xx` });
  must(bad.status === 401, `a tampered QR was not refused (${bad.status})`);
  const r = await call(bankerToken, "POST", "/checkin/verify", { token });
  must(r.status === 200 && r.body.summary?.name === "Ramesh Shetty", `-> ${r.status} ${short(r.body)}`);
  return `summary for ${r.body.summary.name}`;
});

/* ---------- clean up and report ---------- */

const cleanup: string[] = [];
try { if (appId) { await deleteApplication(store, appId); cleanup.push("application"); } } catch { cleanup.push("application FAILED"); }
for (const uid of [CUSTOMER_UID, BANKER_UID]) {
  try { await auth.deleteUser(uid); cleanup.push(uid.split("-")[1]); } catch { /* never created */ }
}

const pad = Math.max(...results.map((r) => r.name.length));
console.log(`\nsmoke: ${BASE}${mockAi === undefined ? "" : mockAi ? "  (MOCK_AI=true)" : "  (real AI)"}`);
for (const r of results) console.log(`  ${r.ok ? "PASS" : "FAIL"}  ${r.name.padEnd(pad)}  ${r.info}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} steps passed. Cleaned up: ${cleanup.join(", ") || "nothing"}.`);
process.exit(failed ? 1 : 0);
