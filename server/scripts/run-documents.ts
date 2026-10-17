// Runs POST /documents/extract + POST /applications/:id/check on the FAKE demo documents.
//   npm run docs            -> MOCK_AI (QR-based reader)
//   npm run docs -- --real  -> real Gemini document reading (needs GEMINI_API_KEY); interview answers stay mocked
import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { mockExtractor } from "../src/ai/mock.js";
import { createApp } from "../src/app.js";
import { loadEnv } from "../src/env.js";
import { createExtractor } from "../src/services/gemini.js";
import { MemoryStore } from "../src/store.js";

const DOCS = join(dirname(fileURLToPath(import.meta.url)), "..", "assets", "demo-docs");
export const FAKE_AADHAAR_NUMBER = "234567890124";

export interface Scenario {
  name: string;
  status: string;
  eligible: boolean;
  score: number;
  codes: string[];
  mistakesCaught: number;
  documents: Record<string, any>;
  leakedAadhaar: boolean;
}

export async function runDocScenarios(opts: { real?: boolean } = {}) {
  // The real reader is rate limited on the free tier (5 requests/min): --real only reads the clean set (3 calls).
  const store = new MemoryStore();
  const mockEnv = loadEnv({ MOCK_AI: "true", QR_JWT_SECRET: "s" } as NodeJS.ProcessEnv);
  const extractor = opts.real
    ? { extractAnswer: mockExtractor.extractAnswer, extractDoc: createExtractor(loadEnv({ ...process.env, MOCK_AI: "false" } as NodeJS.ProcessEnv)).extractDoc }
    : undefined;
  const server = createApp({ env: mockEnv, store, extractor, verifier: async () => ({ uid: "u1", role: "customer", anonymous: true }) }).listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const headers = { authorization: "Bearer x" };

  const json = async (path: string, body: unknown) => {
    const r = await fetch(base + path, { method: "POST", headers: { ...headers, "content-type": "application/json" }, body: JSON.stringify(body) });
    return { status: r.status, body: await r.json() };
  };
  const upload = async (appId: string, kind: string, file: string) => {
    const fd = new FormData();
    fd.append("appId", appId);
    fd.append("kind", kind);
    fd.append("image", new Blob([readFileSync(join(DOCS, file))], { type: "image/jpeg" }), file.split("/").pop());
    const r = await fetch(`${base}/documents/extract`, { method: "POST", headers, body: fd });
    return { status: r.status, body: await r.json() };
  };

  async function newApp() {
    const created = await json("/applications", { language: "en-IN", consent: true });
    const id = created.body.id as string;
    const answers = ["Ramesh Shetty", "15/03/1950", "98765 43210", "12 MG Road, Bengaluru", "retired", "Sita Shetty", "spouse", "yes"];
    for (const a of answers) {
      await json("/interview/answer", { appId: id, text: a, source: "typed" });
      await json("/interview/confirm", { appId: id, text: "yes" });
    }
    if (store.docs.get(`applications/${id}`)!.status !== "docs_pending") throw new Error("interview did not finish");
    return id;
  }

  async function check(name: string, id: string): Promise<Scenario> {
    const r = await json(`/applications/${id}/check`, {});
    if (r.status !== 200) throw new Error(`${name}: check -> ${r.status} ${JSON.stringify(r.body)}`);
    const app = store.docs.get(`applications/${id}`)!;
    return {
      name,
      status: r.body.status,
      eligible: r.body.eligible,
      score: r.body.readiness.score,
      codes: r.body.mismatches.map((m: any) => `${m.code}${m.doc ? `(${m.doc})` : ""}`),
      mistakesCaught: app.metrics.mistakesCaught,
      documents: app.documents,
      leakedAadhaar: JSON.stringify([...store.docs.values()].map((d) => ({ ...d, data: undefined }))).includes(FAKE_AADHAAR_NUMBER),
    };
  }

  const out: Scenario[] = [];
  const set = async (id: string, dir: string, only?: string[]) => {
    for (const k of ["aadhaar", "pan", "passbook"]) if (!only || only.includes(k)) {
      const r = await upload(id, k, `${dir}/${k}.jpg`);
      if (r.status !== 200) throw new Error(`upload ${dir}/${k}: ${r.status} ${JSON.stringify(r.body)}`);
    }
  };

  let id = await newApp();
  await set(id, "clean");
  out.push(await check("clean set", id));
  if (opts.real) { server.close(); return { scenarios: out, rejects: {} as Record<string, number> }; }

  id = await newApp();
  await set(id, "name-variant");
  out.push(await check("name-variant set", id));

  id = await newApp();
  await set(id, "clean", ["pan", "passbook"]);
  await upload(id, "aadhaar", "blurry-aadhaar.jpg");
  out.push(await check("blurry aadhaar", id));
  await upload(id, "aadhaar", "clean/aadhaar.jpg"); // retake
  out.push(await check("blurry aadhaar, retaken", id));

  id = await newApp();
  await set(id, "clean", ["pan", "passbook"]);
  await upload(id, "aadhaar", "invalid-aadhaar.jpg");
  out.push(await check("invalid aadhaar number", id));

  // Guard rails
  const rejects: Record<string, number> = {
    notImage: await (async () => {
      const fd = new FormData();
      fd.append("appId", id); fd.append("kind", "pan");
      fd.append("image", new Blob(["hello"], { type: "text/plain" }), "x.txt");
      return (await fetch(`${base}/documents/extract`, { method: "POST", headers, body: fd })).status;
    })(),
    noAuth: (await fetch(`${base}/documents/extract`, { method: "POST" })).status,
  };

  server.close();
  return { scenarios: out, rejects };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const real = process.argv.includes("--real");
  const { scenarios, rejects } = await runDocScenarios({ real });
  console.log(real ? "== REAL Gemini document reading ==" : "== MOCK_AI document reading ==");
  for (const s of scenarios) {
    console.log(`${s.name.padEnd(26)} status=${s.status} eligible=${s.eligible} score=${s.score} mistakes=${s.mistakesCaught} problems=[${s.codes.join(", ")}]`);
    if (real) for (const [k, d] of Object.entries(s.documents)) console.log(`   ${k}: valid=${(d as any).valid} blurry=${(d as any).blurry} fields=${JSON.stringify((d as any).fields)} conf=${JSON.stringify((d as any).confidence)}`);
  }
  console.log("rejects:", JSON.stringify(rejects));
}
