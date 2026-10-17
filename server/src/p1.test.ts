import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { after, describe, it } from "node:test";
import sharp from "sharp";
import { createApp } from "./app.js";
import { loadEnv } from "./env.js";
import { compressImage, MAX_BYTES } from "./fileStore.js";
import { canTransition, TRANSITIONS } from "./status.js";
import { MemoryStore } from "./store.js";

describe("status transitions", () => {
  it("allows the documented flow", () => {
    assert.ok(canTransition("draft", "submitted"));
    assert.ok(canTransition("submitted", "in_review"));
    assert.ok(canTransition("in_review", "approved"));
    assert.ok(canTransition("needs_info", "submitted"));
  });
  it("rejects illegal moves and terminal exits", () => {
    assert.ok(!canTransition("draft", "approved"));
    assert.ok(!canTransition("approved", "draft"));
    assert.deepEqual(TRANSITIONS.rejected, []);
  });
});

describe("api", () => {
  const store = new MemoryStore();
  const env = loadEnv({ MOCK_AI: "true", JWT_SECRET: "test-secret" } as NodeJS.ProcessEnv);
  const verifier = async (t: string) => {
    if (t === "anon") return { uid: "anon-1", role: "applicant" as const, anonymous: true };
    if (t === "other") return { uid: "anon-2", role: "applicant" as const, anonymous: true };
    if (t === "banker") return { uid: "b-1", role: "banker" as const, anonymous: false };
    throw new Error("bad");
  };
  const server = createApp({ env, store, verifier }).listen(0);
  const base = () => `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  after(() => server.close());

  const create = (tok: string, body: unknown) =>
    fetch(`${base()}/applications`, {
      method: "POST",
      headers: { authorization: `Bearer ${tok}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  it("401 without a token", async () => {
    const r = await fetch(`${base()}/applications`, { method: "POST" });
    assert.equal(r.status, 401);
    assert.equal((await r.json()).code, "unauthenticated");
  });

  it("anonymous create writes an audit entry; media and file access are gated", async () => {
    const r = await create("anon", { language: "hi", consent: true });
    assert.equal(r.status, 201);
    const body = await r.json();
    assert.equal(body.question.id, "full_name");

    const audits = [...store.docs.entries()].filter(([k]) => k.startsWith("audit/")).map(([, v]) => v);
    assert.ok(audits.some((a) => a.action === "application.create" && a.actorUid === "anon-1" && a.appId === body.id));

    assert.equal((await fetch(base() + body.question.audioUrl)).status, 200);
    assert.equal((await fetch(`${base()}/media/x?token=bad`)).status, 401);

    store.docs.set(`applications/${body.id}/files/photo`, { data: Buffer.from("x"), mime: "image/jpeg" });
    const get = (tok: string) => fetch(`${base()}/files/${body.id}/photo`, { headers: { authorization: `Bearer ${tok}` } });
    assert.equal((await get("anon")).status, 200);
    assert.equal((await get("banker")).status, 200);
    assert.equal((await get("other")).status, 403);
  });

  it("rejects missing consent", async () => {
    assert.equal((await create("anon", { language: "en", consent: false })).status, 400);
  });
});

describe("file compression", () => {
  it("brings a >1.5 MB image under 900 KB", async () => {
    const w = 2000, h = 1500, raw = Buffer.alloc(w * h * 3);
    for (let i = 0; i < raw.length; i++) raw[i] = Math.floor(Math.random() * 256);
    const big = await sharp(raw, { raw: { width: w, height: h, channels: 3 } }).jpeg({ quality: 90 }).toBuffer();
    assert.ok(big.length > 1.5 * 1024 * 1024, `input only ${big.length}`);
    const out = await compressImage(big);
    assert.ok(out.length < MAX_BYTES, `output ${out.length}`);
  });
});
