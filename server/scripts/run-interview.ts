// Runs the whole interview in-process with typed answers under MOCK_AI=true.
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { createApp } from "../src/app.js";
import { loadEnv } from "../src/env.js";
import { MemoryStore } from "../src/store.js";

const store = new MemoryStore();
const env = loadEnv({ MOCK_AI: "true", QR_JWT_SECRET: "s" } as NodeJS.ProcessEnv);
const server = createApp({ env, store, verifier: async () => ({ uid: "u1", role: "customer", anonymous: true }) }).listen(0);
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
const post = async (path: string, body: unknown) => {
  const r = await fetch(base + path, { method: "POST", headers: { authorization: "Bearer x", "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json();
  assert.equal(r.status, path === "/applications" ? 201 : 200, `${path}: ${JSON.stringify(j)}`);
  return j;
};
const doc = (id: string) => store.docs.get(`applications/${id}`)!;
const say = (id: string, text: string) => post("/interview/answer", { appId: id, text, source: "typed" });
const yes = (id: string) => post("/interview/confirm", { appId: id, text: "yes" });

for (const lang of ["en-IN", "hi-IN", "kn-IN"]) {
  const { id } = await post("/applications", { language: lang, consent: true });
  assert.equal(doc(id).language, lang);

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
  assert.equal(doc(id).answers.full_name.value, "Ramesh Kumar");
  assert.equal(doc(id).answers.full_name.confirmed, true);

  // 2. OTP phrase: blocked, nothing stored, scamBlocks++, audit has no content
  const before = JSON.stringify(doc(id).answers);
  r = await say(id, "my OTP is 4 8 2 9 1 7");
  assert.equal(r.blocked, true);
  assert.ok(r.warning.audioUrl);
  assert.equal(JSON.stringify(doc(id).answers), before);
  assert.equal(doc(id).metrics.scamBlocks, 1);
  assert.ok(!JSON.stringify([...store.docs.values()]).includes("482917"));

  // 3. the remaining fields -> docs_pending
  const rest = ["15/03/1950", "98765 43210", "12 MG Road, Bengaluru, pin code 560001", "retired", "Sita Kumar", "spouse", "yes"];
  for (const a of rest) { await say(id, a); r = await yes(id); }
  assert.equal(r.state, "docs_pending");
  const d = doc(id);
  assert.equal(d.status, "docs_pending");
  assert.equal(d.answers.dob.value, "1950-03-15");
  assert.equal(d.answers.mobile.value, "9876543210");
  assert.equal(d.answers.occupation.value, "retired");
  assert.equal(d.notify.consent, true);
  assert.equal(d.notify.phone, "9876543210");
  console.log(`ok [${lang}]`, Object.keys(d.answers).length, "fields confirmed, status", d.status);
}
server.close();
