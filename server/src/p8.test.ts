import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { after, describe, it } from "node:test";
import { createApp } from "./app.js";
import { loadEnv } from "./env.js";
import { MemoryStore } from "./store.js";

const DOCS = new URL("../assets/demo-docs/", import.meta.url);

describe("resolve-name + blur score (P8)", () => {
  const store = new MemoryStore();
  const env = loadEnv({ MOCK_AI: "true", QR_JWT_SECRET: "s", NOTIFY_MODE: "off" } as NodeJS.ProcessEnv);
  const server = createApp({ env, store, verifier: async (t) => ({ uid: t, role: "customer", anonymous: true }) }).listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  after(() => server.close());

  const call = async (tok: string, path: string, body?: unknown) => {
    const r = await fetch(base + path, { method: "POST", headers: { authorization: `Bearer ${tok}`, "content-type": "application/json" }, body: JSON.stringify(body ?? {}) });
    return { status: r.status, body: (await r.json()) as any };
  };
  const upload = async (tok: string, id: string, kind: string, file: string) => {
    const fd = new FormData();
    fd.append("appId", id); fd.append("kind", kind);
    fd.append("image", new Blob([readFileSync(new URL(file, DOCS))], { type: "image/jpeg" }), "x.jpg");
    const r = await fetch(`${base}/documents/extract`, { method: "POST", headers: { authorization: `Bearer ${tok}` }, body: fd });
    return { status: r.status, body: (await r.json()) as any };
  };
  async function seed(tok: string, docs: [string, string][]) {
    const id = (await call(tok, "/applications", { language: "en", consent: true })).body.id as string;
    for (const a of ["Ramesh Shetty", "15/03/1950", "9876543210", "12 MG Road, Bengaluru", "retired", "Sita Shetty", "spouse", "yes"]) {
      await call(tok, "/interview/answer", { appId: id, text: a, source: "typed" });
      await call(tok, "/interview/confirm", { appId: id, text: "yes" });
    }
    const out = [];
    for (const [k, f] of docs) out.push(await upload(tok, id, k, f));
    return { id, uploads: out };
  }

  it("extract returns the server blur score and threshold (sharp vs blurred)", async () => {
    const { uploads } = await seed("u1", [["aadhaar", "clean/aadhaar.jpg"]]);
    assert.ok(uploads[0].body.blurScore > 100, String(uploads[0].body.blurScore));
    assert.equal(typeof uploads[0].body.blurThreshold, "number");
    assert.equal(uploads[0].body.blurry, false);

    const { uploads: b } = await seed("u2", [["aadhaar", "blurry-aadhaar.jpg"]]);
    assert.ok(b[0].body.blurScore < b[0].body.blurThreshold);
    assert.equal(b[0].body.blurry, true);
    assert.equal(b[0].body.issues[0].code, "PHOTO_BLURRY");
  });

  it("name issue carries both spellings; choosing one resolves it and updates the form name", async () => {
    const { id } = await seed("u3", [["aadhaar", "clean/aadhaar.jpg"], ["pan", "name-variant/pan.jpg"], ["passbook", "clean/passbook.jpg"]]);
    let r = await call("u3", `/applications/${id}/check`);
    assert.equal(r.body.mismatches.length, 1);
    const m = r.body.mismatches[0];
    assert.equal(m.code, "NAME_SPELLED_DIFFERENTLY");
    assert.deepEqual(m.detail, { answerName: "Ramesh Shetty", docName: "RAMESH K SHETTY" });

    assert.equal((await call("u3", `/applications/${id}/resolve-name`, { use: "nope" })).status, 400);
    assert.equal((await call("u4", `/applications/${id}/resolve-name`, { use: "pan" })).status, 403);

    r = await call("u3", `/applications/${id}/resolve-name`, { use: "pan" });
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.mismatches, []);
    assert.equal(r.body.eligible, true);
    assert.ok(r.body.readiness.score >= 98);
    const app = store.docs.get(`applications/${id}`)!;
    assert.equal(app.answers.full_name.valueEn, "RAMESH K SHETTY");
    assert.equal(app.nameResolved.use, "pan");
    assert.ok([...store.docs.keys()].some((k) => k.startsWith(`applications/${id}/audit/`)));
  });

  it("keeping what I said (use: answers) also acknowledges the warning without changing the name", async () => {
    const { id } = await seed("u5", [["aadhaar", "clean/aadhaar.jpg"], ["pan", "name-variant/pan.jpg"], ["passbook", "clean/passbook.jpg"]]);
    await call("u5", `/applications/${id}/check`);
    const r = await call("u5", `/applications/${id}/resolve-name`, { use: "answers" });
    assert.deepEqual(r.body.mismatches, []);
    assert.equal(store.docs.get(`applications/${id}`)!.answers.full_name.valueEn, "Ramesh Shetty");
  });

  it("a hard NAME_MISMATCH is not silenced by resolve-name", async () => {
    const { id } = await seed("u6", [["aadhaar", "clean/aadhaar.jpg"]]);
    const app = store.docs.get(`applications/${id}`)!;
    app.documents.pan = { fields: { name: "SUNITA PATIL", dob: "1950-03-15", pan: "ABCPS1234F" }, valid: true, blurry: false };
    const r = await call("u6", `/applications/${id}/resolve-name`, { use: "answers" });
    assert.ok(r.body.mismatches.some((x: any) => x.code === "NAME_MISMATCH"));
  });
});
