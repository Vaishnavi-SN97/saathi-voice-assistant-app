import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { after, describe, it } from "node:test";
import { createApp, createCtx } from "./app.js";
import { loadEnv } from "./env.js";
import { sendBackApplication } from "./routes/lifecycle.js";
import { computeMetrics } from "./services/metrics.js";
import { MemoryStore } from "./store.js";

const now = new Date("2026-10-17T10:00:00+05:30");
const mk = (status: string, m: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({ status, metrics: m, ...extra });

describe("computeMetrics", () => {
  const apps = [
    // started today, ready 12 min later, approved first time
    mk("approved", { startedAt: "2026-10-17T09:00:00+05:30", readyAt: "2026-10-17T09:12:00+05:30", mistakesCaught: 2, scamBlocks: 1 }),
    // started today, ready 8 min later, signed first time
    mk("signed", { startedAt: "2026-10-17T09:30:00+05:30", readyAt: "2026-10-17T09:38:00+05:30", mistakesCaught: 0 }),
    // yesterday, sent back once then waiting again: decided but NOT first visit
    mk("ready_for_review", { startedAt: "2026-10-16T09:00:00+05:30", readyAt: "2026-10-16T09:10:00+05:30", sentBackCount: 1, mistakesCaught: 1 }),
    // currently sent back
    mk("sent_back", { startedAt: "2026-10-16T11:00:00+05:30", readyAt: "2026-10-16T11:20:00+05:30", sentBackCount: 1 }),
    // not decided yet
    mk("ready_for_review", { startedAt: "2026-10-17T09:50:00+05:30", readyAt: "2026-10-17T10:00:00+05:30" }),
    // draft (no ready time), seeded demo row
    mk("draft", { startedAt: "2026-10-17T09:55:00+05:30", scamBlocks: 3 }, { demo: true }),
  ];

  it("computes every tile", () => {
    const r = computeMetrics(apps, { baselineMinutes: 30, now });
    assert.equal(r.tiles.applicationsToday, 4); // the two approved/signed, the 10:00-ready one, the draft
    assert.equal(r.tiles.firstVisitApprovalRate, 50); // decided: 2 first-time + 2 sent-back-at-some-point
    assert.equal(r.tiles.averageMinutes, 12); // (12 + 8 + 10 + 20 + 10) / 5
    assert.equal(r.tiles.baselineMinutes, 30);
    assert.equal(r.tiles.minutesSaved, 18);
    assert.equal(r.tiles.mistakesCaught, 3);
    assert.equal(r.tiles.scamBlocks, 4);
    assert.deepEqual(r.counts, { applications: 6, demo: 1, included: 6 });
    assert.equal(r.includesDemo, true);
  });

  it("can leave demo rows out", () => {
    const r = computeMetrics(apps, { baselineMinutes: 30, excludeDemo: true, now });
    assert.equal(r.tiles.applicationsToday, 3);
    assert.equal(r.tiles.scamBlocks, 1);
    assert.equal(r.includesDemo, false);
    assert.deepEqual(r.counts, { applications: 6, demo: 1, included: 5 });
  });

  it("has no invented numbers for an empty or undecided set", () => {
    const r = computeMetrics([], { baselineMinutes: 30, now });
    assert.equal(r.tiles.firstVisitApprovalRate, null);
    assert.equal(r.tiles.averageMinutes, null);
    assert.equal(r.tiles.minutesSaved, null);
    assert.equal(r.tiles.applicationsToday, 0);
  });
});

describe("GET /metrics + send-back counter", () => {
  const store = new MemoryStore();
  const env = loadEnv({ MOCK_AI: "true", QR_JWT_SECRET: "s", BASELINE_MANUAL_MINUTES: "25", NOTIFY_MODE: "off" } as NodeJS.ProcessEnv);
  const server = createApp({
    env, store,
    verifier: async (t) => (t === "banker" ? { uid: "b", role: "banker", anonymous: false } : { uid: t, role: "customer", anonymous: true }),
  }).listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  after(() => server.close());
  const get = async (tok: string, path: string) => {
    const r = await fetch(base + path, { headers: { authorization: `Bearer ${tok}` } });
    return { status: r.status, body: (await r.json()) as any };
  };

  it("banker only; ignores audit sub-documents; honours BASELINE_MANUAL_MINUTES and ?demo=exclude", async () => {
    const t = new Date().toISOString();
    store.docs.set("applications/a1", { status: "approved", metrics: { startedAt: t, readyAt: t, mistakesCaught: 2 } });
    store.docs.set("applications/a2", { status: "draft", demo: true, metrics: { startedAt: t, scamBlocks: 5 } });
    store.docs.set("applications/a1/audit/x", { action: "x", metrics: { mistakesCaught: 999 } });
    assert.equal((await get("cust", "/metrics")).status, 403);
    assert.equal((await fetch(`${base}/metrics`)).status, 401);
    const all = await get("banker", "/metrics");
    assert.equal(all.status, 200);
    assert.equal(all.body.tiles.baselineMinutes, 25);
    assert.equal(all.body.tiles.mistakesCaught, 2);
    assert.equal(all.body.tiles.scamBlocks, 5);
    assert.equal(all.body.includesDemo, true);
    const real = await get("banker", "/metrics?demo=exclude");
    assert.equal(real.body.tiles.scamBlocks, 0);
    assert.equal(real.body.includesDemo, false);
  });

  it("sending an application back counts it", async () => {
    const ctx = createCtx({ env, store });
    store.docs.set("applications/s1", { status: "ready_for_review", language: "en-IN", metrics: {}, notify: { consent: false } });
    await sendBackApplication(ctx, "system", "s1", store.docs.get("applications/s1")!, "Please retake the PAN photo");
    assert.equal(store.docs.get("applications/s1")!.metrics.sentBackCount, 1);
  });
});
