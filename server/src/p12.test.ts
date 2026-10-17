import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { after, describe, it } from "node:test";
import { createApp } from "./app.js";
import { loadEnv } from "./env.js";
import { runRetention } from "./services/retention.js";
import { MemoryStore } from "./store.js";

const now = new Date("2026-10-17T12:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString();

describe("retention cleanup", () => {
  const seed = () => {
    const s = new MemoryStore();
    const app = (id: string, status: string, ageDays: number, extra: Record<string, unknown> = {}) => {
      s.docs.set(`applications/${id}`, { status, updatedAt: daysAgo(ageDays), ...extra });
      s.docs.set(`applications/${id}/audit/a1`, { action: "x" });
      for (const k of ["aadhaar", "pan", "passbook", "signature", "pdf"]) s.docs.set(`applications/${id}/files/${k}`, { data: Buffer.from("x") });
    };
    app("signed1", "signed", 1);
    app("old-docs", "docs_pending", 8);
    app("old-draft", "draft", 30);
    app("old-sentback", "sent_back", 9);
    app("fresh-docs", "docs_pending", 6);
    app("old-review", "ready_for_review", 40); // waiting for the bank: never auto-deleted
    app("old-approved", "approved", 40);
    app("demo-old", "docs_pending", 90, { demo: true });
    return s;
  };

  it("after signing: deletes the ID photos, keeps the signed PDF and signature", async () => {
    const s = seed();
    const r = await runRetention(s, { now });
    assert.equal(r.photosDeleted, 3);
    for (const k of ["aadhaar", "pan", "passbook"]) assert.ok(!s.docs.has(`applications/signed1/files/${k}`), k);
    assert.ok(s.docs.has("applications/signed1/files/pdf") && s.docs.has("applications/signed1/files/signature"));
    assert.ok(s.docs.get("applications/signed1")!.filesDeletedAt);
    assert.ok([...s.docs.values()].some((d) => d.action === "retention.photos_deleted"));
  });

  it("abandoned for more than 7 days: deleted with files and audit; recent, in-review, approved and demo rows stay", async () => {
    const s = seed();
    const r = await runRetention(s, { now });
    assert.equal(r.applicationsDeleted, 3);
    for (const id of ["old-docs", "old-draft", "old-sentback"]) {
      assert.ok(![...s.docs.keys()].some((k) => k.startsWith(`applications/${id}`)), `${id} should be gone`);
    }
    for (const id of ["fresh-docs", "old-review", "old-approved", "demo-old", "signed1"]) assert.ok(s.docs.has(`applications/${id}`), `${id} should stay`);
    assert.ok(s.docs.has("applications/fresh-docs/files/aadhaar"));
  });

  it("is idempotent and honours a custom number of days", async () => {
    const s = seed();
    await runRetention(s, { now });
    const second = await runRetention(s, { now });
    assert.deepEqual([second.photosDeleted, second.applicationsDeleted], [0, 0]);
    const strict = await runRetention(s, { now, days: 5 });
    assert.equal(strict.applicationsDeleted, 1); // fresh-docs (6 days) now counts as abandoned
  });
});

import { Notifier } from "./services/notify.js";
import { MediaStore } from "./mediaStore.js";

describe("seeded demo rows are never messaged", () => {
  it("skips WhatsApp for demo: true even with consent, a phone and credentials", async () => {
    const sent: unknown[] = [];
    const store = new MemoryStore();
    const e = loadEnv({ MOCK_AI: "true", TWILIO_ACCOUNT_SID: "AC", TWILIO_AUTH_TOKEN: "t", TWILIO_WHATSAPP_FROM: "+14155238886" } as NodeJS.ProcessEnv);
    const n = new Notifier(e, store, new MediaStore(store, "s"), async (m) => { sent.push(m); });
    const app = { language: "hi-IN", demo: true, notify: { consent: true, phone: "9000012345" } };
    assert.deepEqual(await n.notify("demo-1", app, "approved"), { sent: false, reason: "demo_data" });
    assert.equal(sent.length, 0);
    assert.equal((await n.notify("real-1", { ...app, demo: undefined }, "approved")).sent, true);
  });
});

describe("/health", () => {
  const env = loadEnv({ MOCK_AI: "true", QR_JWT_SECRET: "s" } as NodeJS.ProcessEnv);
  const server = createApp({ env, store: new MemoryStore(), verifier: async () => ({ uid: "u", role: "customer", anonymous: true }) }).listen(0);
  after(() => server.close());
  it("tells whether the AI is mocked, and nothing secret", async () => {
    const r = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/health`);
    assert.deepEqual(await r.json(), { ok: true, mockAi: true });
  });
});
