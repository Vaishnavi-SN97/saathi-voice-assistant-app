// The main journey against a RUNNING API (the deployed one, or in-process with --stub to test this script itself).
//   npm run journey:remote -- --url https://your-api.up.railway.app     real API, real Firebase sign-in
//   npm run journey:remote -- --stub                                     in-process API, fake tokens, MOCK_AI
//
// Real mode needs (env or web/.env): FIREBASE_WEB_API_KEY (or VITE_FIREBASE_API_KEY), BANKER_EMAIL, BANKER_PASSWORD.
// Without them it prints SKIP and exits 0. It reports whether the API runs with MOCK_AI (from /health), so a pass with
// "AI: real" means Sarvam / Gemini were actually used. Nothing secret is printed.
import { readFileSync, existsSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import sharp from "sharp";

const HERE = dirname(fileURLToPath(import.meta.url));
const DOCS = join(HERE, "..", "assets", "demo-docs", "clean");

export interface Transport {
  base: string;
  customerToken(): Promise<string>;
  bankerToken(): Promise<string>;
  /** The approved application's QR token (what the customer's phone would show). */
  qrToken(appId: string, customerToken: string): Promise<string>;
}

class StepError extends Error {}
const must = (cond: unknown, msg: string): asserts cond => { if (!cond) throw new StepError(msg); };

export async function runRemoteJourney(t: Transport, log: (s: string) => void = console.log) {
  const call = async (token: string, method: string, path: string, body?: unknown) => {
    const r = await fetch(t.base + path, { method, headers: { authorization: `Bearer ${token}`, ...(body === undefined ? {} : { "content-type": "application/json" }) }, body: body === undefined ? undefined : JSON.stringify(body) });
    const ct = r.headers.get("content-type") ?? "";
    return { status: r.status, body: ct.includes("json") ? ((await r.json()) as any) : Buffer.from(await r.arrayBuffer()) };
  };
  const step = (s: string) => log(`  ok  ${s}`);

  const health = await (await fetch(`${t.base}/health`)).json().catch(() => null) as { ok?: boolean; mockAi?: boolean } | null;
  must(health?.ok === true, `GET /health did not answer ok (${JSON.stringify(health)})`);
  step(`/health ok (AI: ${health!.mockAi ? "MOCK_AI" : "real"})`);

  const cust = await t.customerToken();
  const banker = await t.bankerToken();
  step("signed in as a new anonymous customer and as the banker");

  const created = await call(cust, "POST", "/applications", { language: "en-IN", consent: true });
  must(created.status === 201, `POST /applications -> ${created.status} ${JSON.stringify(created.body)}`);
  const id = created.body.id as string;
  must(created.body.question?.audioUrl, "first question has no audio link");
  step(`application created (${id.slice(0, 6)}…), first question has audio`);

  for (const answer of ["Ramesh Shetty", "15/03/1950", "9876543210", "12 MG Road, Bengaluru", "retired", "Sita Shetty", "spouse", "yes"]) {
    const a = await call(cust, "POST", "/interview/answer", { appId: id, text: answer, source: "typed" });
    must(a.status === 200 && a.body.state === "confirming", `interview answer "${answer}" -> ${a.status} ${JSON.stringify(a.body).slice(0, 160)}`);
    const c = await call(cust, "POST", "/interview/confirm", { appId: id, text: "yes" });
    must(c.status === 200, `interview confirm -> ${c.status}`);
  }
  step("interview finished (8 answers confirmed)");

  const blocked = await call(cust, "POST", "/interview/answer", { appId: id, text: "my OTP is 4 8 2 9 1 7", source: "typed" }).catch(() => null);
  // after the last answer there is no open question: either a 409 or a scam block is acceptable, a 5xx is not
  must(blocked && blocked.status < 500, "OTP phrase caused a server error");

  for (const kind of ["aadhaar", "pan", "passbook"]) {
    const fd = new FormData();
    fd.append("appId", id);
    fd.append("kind", kind);
    fd.append("image", new Blob([readFileSync(join(DOCS, `${kind}.jpg`))], { type: "image/jpeg" }), `${kind}.jpg`);
    const r = await fetch(`${t.base}/documents/extract`, { method: "POST", headers: { authorization: `Bearer ${cust}` }, body: fd });
    const j = (await r.json()) as any;
    must(r.status === 200, `document ${kind} -> ${r.status} ${JSON.stringify(j).slice(0, 160)}`);
    must(!j.blurry && j.valid, `document ${kind} was judged ${j.blurry ? "blurry" : "invalid"} (fields: ${JSON.stringify(j.fields)})`);
  }
  step("3 demo documents read and valid");

  const chk = await call(cust, "POST", `/applications/${id}/check`, {});
  must(chk.status === 200 && chk.body.eligible, `check -> ${chk.status} eligible=${chk.body.eligible} problems=${(chk.body.mismatches ?? []).map((m: any) => m.code)}`);
  step(`check: score ${chk.body.readiness.score}, no blocking problems`);

  const sub = await call(cust, "POST", `/applications/${id}/submit`, {});
  must(sub.status === 200, `submit -> ${sub.status} ${JSON.stringify(sub.body).slice(0, 160)}`);
  step("submitted (ready_for_review)");

  must((await call(cust, "POST", `/applications/${id}/review`, { decision: "approve" })).status === 403, "a customer was allowed to review");
  step("customer cannot review (403)");

  const rev = await call(banker, "POST", `/applications/${id}/review`, { decision: "approve", note: "journey test" });
  must(rev.status === 200 && rev.body.status === "approved", `review -> ${rev.status} ${JSON.stringify(rev.body).slice(0, 160)} (does the banker account have the role=banker claim?)`);
  step("banker approved");

  const token = await t.qrToken(id, cust);
  const ver = await call(banker, "POST", "/checkin/verify", { token });
  must(ver.status === 200 && ver.body.summary?.name === "Ramesh Shetty", `checkin/verify -> ${ver.status} ${JSON.stringify(ver.body).slice(0, 160)}`);
  step("QR verified at check-in");

  const sig = await sharp({ create: { width: 300, height: 100, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: await sharp({ create: { width: 200, height: 5, channels: 4, background: "#102a43" } }).png().toBuffer(), left: 40, top: 50 }]).png().toBuffer();
  const sign = await call(banker, "POST", `/applications/${id}/sign`, { token, signature: `data:image/png;base64,${sig.toString("base64")}` });
  must(sign.status === 200 && sign.body.status === "signed", `sign -> ${sign.status} ${JSON.stringify(sign.body).slice(0, 160)}`);
  step("signed at the branch");

  const again = await call(banker, "POST", "/checkin/verify", { token });
  must(again.status === 409 && again.body.code === "qr_used", `second verify -> ${again.status}, expected 409 qr_used`);
  step("same QR rejected the second time");

  const pdf = await call(banker, "GET", `/files/${id}/pdf`);
  must(pdf.status === 200 && Buffer.isBuffer(pdf.body) && pdf.body.subarray(0, 4).toString() === "%PDF", "signed PDF not available");
  step("signed PDF available");
  return { appId: id, mockAi: !!health!.mockAi };
}

/* ---------- transports ---------- */

function realTransport(base: string): Transport | { skip: string } {
  const env: Record<string, string | undefined> = { ...process.env };
  const webEnv = join(HERE, "..", "..", "web", ".env");
  if (existsSync(webEnv)) for (const l of readFileSync(webEnv, "utf8").split(/\r?\n/)) { const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(l); if (m && env[m[1]] === undefined) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, ""); }
  const key = env.FIREBASE_WEB_API_KEY ?? env.VITE_FIREBASE_API_KEY;
  const project = env.FIREBASE_PROJECT_ID ?? env.VITE_FIREBASE_PROJECT_ID ?? "saathi-f5b30";
  if (!key) return { skip: "no Firebase web API key (set FIREBASE_WEB_API_KEY or web/.env VITE_FIREBASE_API_KEY)" };
  if (!env.BANKER_EMAIL || !env.BANKER_PASSWORD) return { skip: "no banker login (set BANKER_EMAIL and BANKER_PASSWORD)" };

  const idp = async (op: string, body: unknown) => {
    const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:${op}?key=${key}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = (await r.json()) as any;
    if (!r.ok) throw new StepError(`Firebase ${op} failed: ${j?.error?.message ?? r.status}`);
    return j.idToken as string;
  };
  return {
    base,
    customerToken: () => idp("signUp", { returnSecureToken: true }),
    bankerToken: () => idp("signInWithPassword", { email: env.BANKER_EMAIL, password: env.BANKER_PASSWORD, returnSecureToken: true }),
    // the owner may read their own application document through the Firestore REST API (same rules as the app)
    qrToken: async (appId, customerToken) => {
      const r = await fetch(`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/applications/${appId}`, { headers: { authorization: `Bearer ${customerToken}` } });
      const j = (await r.json()) as any;
      const token = j?.fields?.qr?.mapValue?.fields?.token?.stringValue;
      if (!token) throw new StepError(`could not read the QR token from Firestore (${r.status}); are the Firestore rules deployed?`);
      return token as string;
    },
  };
}

async function stubTransport() {
  const { createApp } = await import("../src/app.js");
  const { loadEnv } = await import("../src/env.js");
  const { MemoryStore } = await import("../src/store.js");
  const store = new MemoryStore();
  const env = loadEnv({ MOCK_AI: "true", QR_JWT_SECRET: "stub", NOTIFY_MODE: "off" } as NodeJS.ProcessEnv);
  const server = createApp({
    env, store,
    verifier: async (tok) => (tok === "banker-token" ? { uid: "banker-1", role: "banker", anonymous: false } : tok.startsWith("customer-") ? { uid: tok, role: "customer", anonymous: true } : Promise.reject(new Error("bad token"))),
  }).listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const t: Transport = {
    base,
    customerToken: async () => "customer-stub-1",
    bankerToken: async () => "banker-token",
    qrToken: async (appId) => store.docs.get(`applications/${appId}`)!.qr.token,
  };
  return { t, close: () => server.close() };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const stub = args.includes("--stub");
  const url = args[args.indexOf("--url") + 1] ?? process.env.API_URL;
  try {
    if (stub) {
      const { t, close } = await stubTransport();
      console.log("journey (in-process stub, MOCK_AI):");
      await runRemoteJourney(t);
      close();
      console.log("JOURNEY PASSED");
    } else {
      if (!url || !/^https?:\/\//.test(url)) { console.error("Usage: npm run journey:remote -- --url https://your-api  (or --stub)"); process.exit(2); }
      const t = realTransport(url.replace(/\/$/, ""));
      if ("skip" in t) { console.log(`SKIP: ${t.skip}`); process.exit(0); }
      console.log(`journey against ${t.base}:`);
      const r = await runRemoteJourney(t);
      console.log(`JOURNEY PASSED (AI: ${r.mockAi ? "mock" : "real Sarvam + Gemini"}). Demo data left behind: application ${r.appId} (signed; its ID photos are removed by the retention cleanup).`);
    }
  } catch (e) {
    console.error(`JOURNEY FAILED: ${(e as Error).message}`);
    process.exit(1);
  }
  process.exit(0);
}
