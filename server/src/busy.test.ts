import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { after, describe, it } from "node:test";
import { createApp } from "./app.js";
import { loadEnv } from "./env.js";
import { AppError } from "./errors.js";
import { mockExtractor } from "./ai/mock.js";
import { SHIELD_WARNING } from "./services/scam-shield.js";
import { MemoryStore } from "./store.js";

describe("AI service down or out of quota", () => {
  const store = new MemoryStore();
  const env = loadEnv({ MOCK_AI: "true", QR_JWT_SECRET: "s" } as NodeJS.ProcessEnv);
  const extractor = {
    extractAnswer: async () => { throw new AppError(502, "upstream_error", "Extraction failed"); },
    extractDoc: mockExtractor.extractDoc,
  };
  const server = createApp({ env, store, extractor, verifier: async (t) => ({ uid: t, role: "customer", anonymous: true }) }).listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  after(() => server.close());

  const call = async (path: string, body: unknown) => {
    const r = await fetch(base + path, { method: "POST", headers: { authorization: "Bearer u", "content-type": "application/json" }, body: JSON.stringify(body) });
    return { status: r.status, body: (await r.json()) as any };
  };
  const create = async (language = "hi") => (await call("/applications", { language, consent: true })).body.id as string;

  it("spoken answer: asks for English typing instead of failing (no 5xx), nothing stored", async () => {
    const id = await create();
    const r = await call("/interview/answer", { appId: id, text: "मेरा नाम रमेश शेट्टी है", source: "voice" });
    assert.equal(r.status, 200);
    assert.equal(r.body.aiBusy, true);
    assert.equal(r.body.typingFallback, true);
    assert.equal(r.body.state, "asking");
    assert.ok(r.body.message.audioUrl);
    assert.deepEqual(store.docs.get(`applications/${id}`)!.answers, {});
    assert.ok([...store.docs.entries()].some(([k, v]) => k.startsWith(`applications/${id}/audit/`) && v.action === "ai.unavailable"));
  });

  it("typed Hindi text cannot be transliterated without the AI: same busy answer", async () => {
    const id = await create();
    const r = await call("/interview/answer", { appId: id, text: "रमेश शेट्टी", source: "typed" });
    assert.equal(r.body.aiBusy, true);
  });

  it("typed English text still works through the simple rules, and the interview can finish", async () => {
    const id = await create("en");
    let r = await call("/interview/answer", { appId: id, text: "Ramesh Shetty", source: "typed" });
    assert.equal(r.body.state, "confirming");
    assert.equal(r.body.display, "Ramesh Shetty");
    r = await call("/interview/confirm", { appId: id, text: "yes" });
    assert.equal(r.body.state, "asking");
    assert.equal(store.docs.get(`applications/${id}`)!.answers.full_name.valueEn, "Ramesh Shetty");
  });

  it("the scam shield still runs first, so an OTP is blocked even while the AI is down", async () => {
    const id = await create("en");
    const r = await call("/interview/answer", { appId: id, text: "my OTP is 4 8 2 9 1 7", source: "typed" });
    assert.equal(r.body.blocked, true);
    assert.equal(r.body.warning.text, SHIELD_WARNING.en);
  });
});
