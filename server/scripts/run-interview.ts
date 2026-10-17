// Runs the whole interview in-process with typed answers under MOCK_AI=true.
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { createApp } from "../src/app.js";
import { loadEnv } from "../src/env.js";
import { MemoryStore } from "../src/store.js";

const store = new MemoryStore();
const env = loadEnv({ MOCK_AI: "true", JWT_SECRET: "s" } as NodeJS.ProcessEnv);
const server = createApp({ env, store, verifier: async () => ({ uid: "u1", role: "applicant", anonymous: true }) }).listen(0);
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
const post = async (path: string, body: unknown) => {
  const r = await fetch(base + path, { method: "POST", headers: { authorization: "Bearer x", "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json();
  assert.equal(r.status, 200 + (path === "/applications" ? 1 : 0), `${path}: ${JSON.stringify(j)}`);
  return j;
};
const doc = (id: string) => store.docs.get(`applications/${id}`)!;
const say = (id: string, text: string) => post("/interview/answer", { appId: id, text, source: "typed" });
const yes = (id: string) => post("/interview/confirm", { appId: id, text: "yes" });

for (const lang of ["en", "hi", "kn"] as const) {
  const { id } = await post("/applications", { language: lang, consent: true });

  // 1. "no" then a new value replaces the old one
  let r = await say(id, "Ravi Kumar");
  assert.equal(r.state, "confirming");
  assert.ok(r.readback.text.includes("Ravi Kumar"));
  r = await post("/interview/confirm", { appId: id, text: "no" });
  assert.equal(r.state, "asking");
  assert.equal(r.question.id, "full_name");
  assert.equal(doc(id).answers.full_name, undefined);
  await say(id, "Ramesh Kumar");
  await yes(id);
  assert.equal(doc(id).answers.full_name, "Ramesh Kumar");

  // 2. OTP phrase is blocked and nothing is stored
  const before = JSON.stringify(doc(id).answers);
  r = await say(id, "my OTP is 4 8 2 9 1 7");
  assert.equal(r.blocked, true);
  assert.equal(doc(id).interview.state, "asking");
  assert.equal(JSON.stringify(doc(id).answers), before);
  assert.ok(!JSON.stringify([...store.docs.values()]).includes("482917"));

  // 3. finish the remaining fields -> docs_pending
  for (const a of ["Tailor", "15000", "50000", "Buy a sewing machine"]) { await say(id, a); r = await yes(id); }
  assert.equal(r.state, "docs_pending");
  assert.equal(doc(id).status, "docs_pending");
  assert.equal(doc(id).answers.monthly_income, 15000);
  assert.equal(doc(id).answers.loan_amount, 50000);
  console.log(`ok [${lang}]`, JSON.stringify(doc(id).answers));
}
server.close();
