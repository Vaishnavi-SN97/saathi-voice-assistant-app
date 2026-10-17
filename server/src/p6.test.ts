import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runJourney } from "../scripts/run-journey.js";
import { loadEnv } from "./env.js";
import { MediaStore } from "./mediaStore.js";
import { Notifier, messageText } from "./services/notify.js";
import { issueQr, verifyQrToken } from "./services/qr.js";
import { MemoryStore } from "./store.js";

describe("journey: submit -> approve -> verify QR -> sign (+ send back, no consent, needs_fix)", () => {
  it("passes end to end under MOCK_AI", { timeout: 120000 }, async () => {
    const { log } = await runJourney();
    assert.equal(log.length, 12);
  });
});

describe("QR token", () => {
  it("round-trips {aid, jti}, rejects tampering and other token types", async () => {
    const q = await issueQr("secret", "app1");
    assert.deepEqual(verifyQrToken("secret", q.token), { aid: "app1", jti: q.jti });
    assert.throws(() => verifyQrToken("other-secret", q.token), /Invalid QR/);
    assert.throws(() => verifyQrToken("secret", q.token + "x"), /Invalid QR/);
    const media = new MediaStore(new MemoryStore(), "secret").signToken("m1");
    assert.throws(() => verifyQrToken("secret", media), /Invalid QR/);
    assert.ok(new Date(q.expiresAt).getTime() - Date.now() > 2.9 * 86400_000);
  });
});

describe("Notifier", () => {
  const app = { language: "en-IN", notify: { consent: true, phone: "9876543210" } };
  const mk = (env: Record<string, string>, send?: (m: any) => Promise<void>) => {
    const store = new MemoryStore();
    return { store, n: new Notifier(loadEnv({ MOCK_AI: "true", ...env } as NodeJS.ProcessEnv), store, new MediaStore(store, "s"), send) };
  };
  const creds = { TWILIO_ACCOUNT_SID: "AC", TWILIO_AUTH_TOKEN: "t", TWILIO_WHATSAPP_FROM: "whatsapp:+14155238886" };

  it("skips with a reason: mode off, no consent, bad phone, no credentials", async () => {
    const calls: unknown[] = [];
    const send = async (m: unknown) => { calls.push(m); };
    assert.deepEqual(await mk({ ...creds, NOTIFY_MODE: "off" }, send).n.notify("a", app, "approved"), { sent: false, reason: "mode_off" });
    assert.deepEqual(await mk(creds, send).n.notify("a", { ...app, notify: { consent: false, phone: "9876543210" } }, "approved"), { sent: false, reason: "no_consent" });
    assert.deepEqual(await mk(creds, send).n.notify("a", { ...app, notify: { consent: true, phone: "123" } }, "approved"), { sent: false, reason: "no_phone" });
    assert.deepEqual(await mk({}).n.notify("a", app, "approved"), { sent: false, reason: "no_credentials" });
    assert.equal(calls.length, 0);
  });

  it("never throws when the sender fails, and normalises the whatsapp: prefix", async () => {
    const failing = mk(creds, async () => { throw new Error("twilio down"); });
    assert.deepEqual(await failing.n.notify("a", app, "signed"), { sent: false, reason: "send_failed" });
    const seen: any[] = [];
    const ok = mk(creds, async (m) => { seen.push(m); });
    assert.deepEqual(await ok.n.notify("a", app, "signed"), { sent: true });
    assert.equal(seen[0].from, "whatsapp:+14155238886");
    assert.equal(seen[0].to, "whatsapp:+919876543210");
  });

  it("has en/hi/kn text for every event", () => {
    for (const ev of ["needs_fix", "ready_for_review", "approved", "sent_back", "signed"] as const) {
      for (const l of ["en", "hi", "kn"] as const) assert.ok(messageText(ev, l, "note").length > 10, `${ev} ${l}`);
    }
  });
});
