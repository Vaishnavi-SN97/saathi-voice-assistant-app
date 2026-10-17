import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { after, describe, it } from "node:test";
import sharp from "sharp";
import { createApp, createCtx } from "./app.js";
import { loadEnv } from "./env.js";
import { approveApplication, sendBackApplication, signApplication } from "./routes/lifecycle.js";
import { MemoryStore } from "./store.js";

describe("status screen support (P9)", () => {
  const store = new MemoryStore();
  const sent: string[] = [];
  const env = loadEnv({
    MOCK_AI: "true", QR_JWT_SECRET: "s", TWILIO_ACCOUNT_SID: "AC", TWILIO_AUTH_TOKEN: "t", TWILIO_WHATSAPP_FROM: "+14155238886",
  } as NodeJS.ProcessEnv);
  const sender = async (m: { body: string }) => { sent.push(m.body); };
  const server = createApp({ env, store, sender, verifier: async (t) => ({ uid: t, role: "customer", anonymous: true }) }).listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  after(() => server.close());

  const seed = (id: string, extra: Record<string, unknown> = {}) =>
    store.docs.set(`applications/${id}`, {
      customerUid: "owner", language: "hi-IN", status: "ready_for_review",
      answers: { full_name: { value: "Ramesh Shetty", valueEn: "Ramesh Shetty", confirmed: true } },
      notify: { consent: true, phone: "9876543210" }, metrics: {}, documents: {}, ...extra,
    });
  const post = async (tok: string, path: string, body: unknown) => {
    const r = await fetch(base + path, { method: "POST", headers: { authorization: `Bearer ${tok}`, "content-type": "application/json" }, body: JSON.stringify(body) });
    return { status: r.status, body: (await r.json()) as any };
  };

  it("notify-consent toggles for the owner only and is audited; WhatsApp stops when off", async () => {
    seed("a1");
    assert.equal((await post("other", "/applications/a1/notify-consent", { consent: false })).status, 403);
    assert.equal((await post("owner", "/applications/a1/notify-consent", { consent: "no" })).status, 400);
    const r = await post("owner", "/applications/a1/notify-consent", { consent: false });
    assert.deepEqual(r.body, { consent: false });
    assert.equal(store.docs.get("applications/a1")!.notify.consent, false);
    assert.equal(store.docs.get("applications/a1")!.notify.phone, "9876543210");
    assert.ok([...store.docs.values()].some((d) => d.action === "notify.consent" && d.detail?.consent === false));

    const ctx = createCtx({ env, store, sender });
    const before = sent.length;
    await approveApplication(ctx, "system", "a1", store.docs.get("applications/a1")!);
    assert.equal(sent.length, before, "no WhatsApp after turning it off");

    await post("owner", "/applications/a1/notify-consent", { consent: true });
    seed("a2");
    await approveApplication(ctx, "system", "a2", store.docs.get("applications/a2")!);
    assert.equal(sent.length, before + 1);
  });

  it("notify-consent is refused while the interview is unfinished", async () => {
    seed("a3", { status: "draft" });
    assert.equal((await post("owner", "/applications/a3/notify-consent", { consent: true })).status, 409);
  });

  it("approve / send back / sign helpers (used by `npm run decide`) move the status and stamp the metrics", async () => {
    const ctx = createCtx({ env, store, sender });
    seed("b1");
    const ap = await approveApplication(ctx, "system", "b1", store.docs.get("applications/b1")!, "ok");
    assert.equal(ap.status, "approved");
    let app = store.docs.get("applications/b1")!;
    assert.ok(app.qr.token && app.qr.jti && app.qr.usedAt === null);
    assert.ok(app.metrics.approvedAt);
    assert.equal(app.review.by, "system");
    await assert.rejects(() => approveApplication(ctx, "system", "b1", app), /Cannot review/);

    const sig = await sharp({ create: { width: 40, height: 20, channels: 4, background: "#fff" } }).png().toBuffer();
    const sg = await signApplication(ctx, "system", "b1", app, sig);
    assert.equal(sg.status, "signed");
    app = store.docs.get("applications/b1")!;
    assert.ok(app.qr.usedAt && app.metrics.signedAt);

    seed("b2");
    const sb = await sendBackApplication(ctx, "system", "b2", store.docs.get("applications/b2")!, "Please retake the PAN photo");
    assert.equal(sb.noteTranslated, "[hi] Please retake the PAN photo");
    assert.equal(store.docs.get("applications/b2")!.status, "sent_back");
  });
});
