// Single-service deploy: the API also serves the built web app (SERVE_WEB=true).
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { after, describe, it } from "node:test";

import { createApp } from "./app.js";
import { loadEnv } from "./env.js";
import { MemoryStore } from "./store.js";

const dist = mkdtempSync(join(tmpdir(), "saathi-dist-"));
writeFileSync(join(dist, "index.html"), "<!doctype html><title>Saathi</title>");
mkdirSync(join(dist, "assets"));
writeFileSync(join(dist, "assets", "app-abc123.js"), "export const x = 1;");

const start = (extra: Record<string, string>) => {
  const env = loadEnv({ MOCK_AI: "true", QR_JWT_SECRET: "s", ...extra } as NodeJS.ProcessEnv);
  const server = createApp({
    env,
    store: new MemoryStore(),
    verifier: async () => ({ uid: "u", role: "customer", anonymous: true }),
  }).listen(0);
  const at = (p: string) => `http://127.0.0.1:${(server.address() as AddressInfo).port}${p}`;
  return { server, at };
};

describe("SERVE_WEB on", () => {
  const { server, at } = start({ SERVE_WEB: "true", WEB_DIST: dist });
  after(() => server.close());

  it("serves the app shell at / and on client-side routes", async () => {
    for (const path of ["/", "/bank", "/status/abc"]) {
      const r = await fetch(at(path));
      assert.equal(r.status, 200, path);
      assert.match(r.headers.get("content-type") ?? "", /text\/html/, path);
      assert.match(await r.text(), /Saathi/, path);
    }
  });

  it("serves hashed assets", async () => {
    const r = await fetch(at("/assets/app-abc123.js"));
    assert.equal(r.status, 200);
  });

  it("never caches the shell, so a deploy is picked up", async () => {
    assert.match((await fetch(at("/"))).headers.get("cache-control") ?? "", /no-cache/);
  });

  it("keeps /health as JSON, not the app shell", async () => {
    assert.deepEqual(await (await fetch(at("/health"))).json(), { ok: true, mockAi: true });
  });

  it("still answers unknown API paths with the JSON 404, not the app shell", async () => {
    const r = await fetch(at("/health/nope"));
    assert.equal(r.status, 404);
    assert.equal((await r.json()).code, "not_found");
  });

  it("lets a protected API path refuse in JSON instead of serving the shell", async () => {
    const r = await fetch(at("/applications/abc"));
    assert.equal(r.status, 401);
    assert.match(r.headers.get("content-type") ?? "", /application\/json/);
  });

  it("moves the service banner to /api", async () => {
    assert.equal((await (await fetch(at("/api"))).json()).web, true);
  });

  it("allows Firebase in the page's content security policy", async () => {
    const csp = (await fetch(at("/"))).headers.get("content-security-policy") ?? "";
    assert.match(csp, /connect-src[^;]*googleapis\.com/);
  });
});

describe("SERVE_WEB off (API only)", () => {
  const { server, at } = start({});
  after(() => server.close());

  it("keeps the JSON banner at / and 404s everything unknown", async () => {
    assert.equal((await (await fetch(at("/"))).json()).service, "saathi-api");
    assert.equal((await fetch(at("/bank"))).status, 404);
  });
});

describe("SERVE_WEB on with no build present", () => {
  const { server, at } = start({ SERVE_WEB: "true", WEB_DIST: join(dist, "missing") });
  after(() => server.close());

  it("falls back to API-only instead of failing to start", async () => {
    assert.equal((await (await fetch(at("/health"))).json() as { ok: boolean }).ok, true);
    assert.equal((await (await fetch(at("/"))).json()).service, "saathi-api");
  });
});
