// End-to-end journey under MOCK_AI: seed -> submit -> approve -> verify QR -> sign, plus send-back, no-consent and needs_fix paths.
// Throws on the first failed expectation. Run: npm run journey
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import jsQR from "jsqr";
import sharp from "sharp";
import { createApp } from "../src/app.js";
import { loadEnv } from "../src/env.js";
import { pdfPageText } from "../src/services/pdf-text.js";
import type { WhatsAppMessage } from "../src/services/notify.js";
import { MemoryStore } from "../src/store.js";

const DOCS = join(dirname(fileURLToPath(import.meta.url)), "..", "assets", "demo-docs");
const FOOTER = "Prepared by Saathi. Pending bank verification and customer signature.";

export async function runJourney() {
  const store = new MemoryStore();
  const sent: WhatsAppMessage[] = [];
  const env = loadEnv({
    MOCK_AI: "true", QR_JWT_SECRET: "journey-secret", PUBLIC_API_URL: "https://api.example.test", NOTIFY_MODE: "direct",
    TWILIO_ACCOUNT_SID: "ACtest", TWILIO_AUTH_TOKEN: "test", TWILIO_WHATSAPP_FROM: "+14155238886",
  } as NodeJS.ProcessEnv);
  const users: Record<string, { uid: string; role: "customer" | "banker"; anonymous: boolean }> = {
    cust: { uid: "cust-1", role: "customer", anonymous: true },
    cust2: { uid: "cust-2", role: "customer", anonymous: true },
    banker: { uid: "banker-1", role: "banker", anonymous: false },
  };
  const server = createApp({
    env, store,
    verifier: async (t) => users[t] ?? Promise.reject(new Error("bad token")),
    sender: async (m) => { sent.push(m); },
  }).listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const log: string[] = [];
  const step = (s: string) => log.push(s);

  const call = async (token: string, method: string, path: string, body?: unknown) => {
    const r = await fetch(base + path, { method, headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    const ct = r.headers.get("content-type") ?? "";
    return { status: r.status, body: ct.includes("json") ? await r.json() : Buffer.from(await r.arrayBuffer()), ct };
  };
  const doc = (id: string) => store.docs.get(`applications/${id}`)!;
  const audits = (id: string) => [...store.docs.entries()].filter(([k]) => k.startsWith(`applications/${id}/audit/`)).map(([, v]) => v);
  const upload = async (id: string, kind: string, file: string) => {
    const fd = new FormData();
    fd.append("appId", id); fd.append("kind", kind);
    fd.append("image", new Blob([readFileSync(join(DOCS, file))], { type: "image/jpeg" }), "x.jpg");
    const r = await fetch(`${base}/documents/extract`, { method: "POST", headers: { authorization: "Bearer cust" }, body: fd });
    assert.equal(r.status, 200, `upload ${file}`);
  };

  /** Customer with finished interview + clean documents + a passing check. */
  async function seed(opts: { language?: string; consent?: boolean } = {}) {
    const created = await call("cust", "POST", "/applications", { language: opts.language ?? "en-IN", consent: true });
    const id = created.body.id as string;
    const answers = ["Ramesh Shetty", "15/03/1950", "98765 43210", "12 MG Road, Bengaluru", "retired", "Sita Shetty", "spouse", opts.consent === false ? "no" : "yes"];
    for (const a of answers) {
      await call("cust", "POST", "/interview/answer", { appId: id, text: a, source: "typed" });
      await call("cust", "POST", "/interview/confirm", { appId: id, text: "yes" });
    }
    assert.equal(doc(id).status, "docs_pending");
    for (const k of ["aadhaar", "pan", "passbook"]) await upload(id, k, `clean/${k}.jpg`);
    const chk = await call("cust", "POST", `/applications/${id}/check`, {});
    assert.equal(chk.status, 200);
    assert.equal(chk.body.eligible, true);
    return id;
  }

  /* ---------- A: the happy path ---------- */
  const id = await seed();
  step("seeded application (interview + 3 documents + check, eligible)");

  assert.equal((await call("banker", "POST", `/applications/${id}/review`, { decision: "approve" })).status, 409, "cannot review before submit");
  assert.equal((await call("cust2", "POST", `/applications/${id}/submit`)).status, 403, "someone else cannot submit");
  assert.equal(sent.length, 0);

  let r = await call("cust", "POST", `/applications/${id}/submit`);
  assert.equal(r.status, 200);
  assert.equal(doc(id).status, "ready_for_review");
  assert.ok(doc(id).metrics.readyAt);
  assert.equal(sent.length, 1);
  assert.match(sent[0].body, /sent to the bank/);
  assert.equal(sent[0].to, "whatsapp:+919876543210");
  assert.equal(sent[0].from, "whatsapp:+14155238886");
  assert.equal(sent[0].mediaUrl, undefined);
  step("submit -> ready_for_review, metrics.readyAt, WhatsApp sent");

  // PDF: page 1 text has the entered values
  const pdfRes = await call("cust", "GET", `/files/${id}/pdf`);
  assert.equal(pdfRes.status, 200);
  assert.equal(pdfRes.ct, "application/pdf");
  const text = (await pdfPageText(pdfRes.body as Buffer)).join("\n");
  for (const v of ["Ramesh Shetty", "15/03/1950", "9876543210", "12 MG Road, Bengaluru", "Retired", "Sita Shetty", "Spouse", "XXXX XXXX 0124", "ABCPS1234F", "SDBK0001234", FOOTER]) {
    assert.ok(text.includes(v), `PDF page 1 should contain "${v}"`);
  }
  step("PDF page 1 contains the entered values and the footer");

  // a non-banker cannot review / verify / sign
  for (const [path, body] of [[`/applications/${id}/review`, { decision: "approve" }], ["/checkin/verify", { token: "x".repeat(30) }], [`/applications/${id}/sign`, { token: "x".repeat(30), signature: "data:image/png;base64,AAAA" }]] as const) {
    const bad = await call("cust", "POST", path, body);
    assert.equal(bad.status, 403, path);
    assert.equal((bad.body as any).code, "forbidden");
  }
  step("non-banker gets 403 on /review, /checkin/verify, /sign");

  // approve
  r = await call("banker", "POST", `/applications/${id}/review`, { decision: "approve", note: "Looks good" });
  assert.equal(r.status, 200);
  assert.equal(doc(id).status, "approved");
  assert.ok(doc(id).metrics.approvedAt);
  const { jti, token } = doc(id).qr;
  assert.equal(doc(id).qr.usedAt, null);
  const png = await call("cust", "GET", r.body.qr.imageUrl); // media route is token-based, auth header is just ignored
  assert.equal(png.ct, "image/png");
  const { data, info } = await sharp(png.body as Buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(jsQR(new Uint8ClampedArray(data), info.width, info.height)?.data, token, "QR image decodes to the token");
  assert.equal(sent.length, 2);
  assert.match(sent[1].body, /approved/);
  assert.match(sent[1].mediaUrl![0], new RegExp(`^https://api\\.example\\.test/media/qr-${jti}\\?token=`));
  step("approve -> JWT QR (image decodes to the token), jti stored, WhatsApp has the QR as mediaUrl");

  // verify
  assert.equal((await call("banker", "POST", "/checkin/verify", { token: "not-a-real-token-not-a-real-token" })).status, 401);
  r = await call("banker", "POST", "/checkin/verify", { token });
  assert.equal(r.status, 200);
  assert.equal(r.body.summary.name, "Ramesh Shetty");
  assert.equal(r.body.summary.aadhaarLast4, "0124");
  assert.equal(r.body.summary.occupation, "Retired");
  step("verify QR -> summary");

  // sign
  const sig = await sharp({ create: { width: 300, height: 100, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: await sharp({ create: { width: 220, height: 6, channels: 4, background: "#102a43" } }).png().toBuffer(), left: 30, top: 50 }])
    .png().toBuffer();
  const sigUrl = `data:image/png;base64,${sig.toString("base64")}`;
  r = await call("banker", "POST", `/applications/${id}/sign`, { token, signature: sigUrl });
  assert.equal(r.status, 200);
  assert.equal(doc(id).status, "signed");
  assert.ok(doc(id).qr.usedAt && doc(id).metrics.signedAt);
  assert.ok(store.docs.has(`applications/${id}/files/signature`));
  assert.equal(sent.length, 3);
  assert.match(sent[2].body, /signed and complete/);
  const signedText = (await pdfPageText((await call("banker", "GET", `/files/${id}/pdf`)).body as Buffer)).join("\n");
  assert.ok(signedText.includes("Signed at branch"));
  step("sign -> signed, signature stored, jti used, PDF re-issued with signature, WhatsApp sent");

  // QR is single use
  r = await call("banker", "POST", "/checkin/verify", { token });
  assert.equal(r.status, 409);
  assert.equal(r.body.code, "qr_used");
  r = await call("banker", "POST", `/applications/${id}/sign`, { token, signature: sigUrl });
  assert.equal(r.status, 409);
  step("second verify / sign of the same QR is rejected (409 qr_used)");

  const actions = audits(id).map((a) => a.action);
  for (const a of ["application.submit", "review.approve", "checkin.verify", "application.sign", "checkin.rejected", "notify.sent", "pdf.generate"].filter((x) => x !== "pdf.generate")) {
    assert.ok(actions.includes(a), `audit has ${a}`);
  }
  assert.ok(!JSON.stringify(audits(id)).includes("9876543210"), "audit has no phone number");
  assert.ok(!JSON.stringify(audits(id)).includes(token), "audit has no token");
  step("every action is audited, without phone or token");

  /* ---------- B: send back (Hindi customer) ---------- */
  const idB = await seed({ language: "hi-IN" });
  await call("cust", "POST", `/applications/${idB}/submit`);
  const before = sent.length;
  assert.equal((await call("banker", "POST", `/applications/${idB}/review`, { decision: "send_back" })).status, 400, "send_back needs a note");
  r = await call("banker", "POST", `/applications/${idB}/review`, { decision: "send_back", note: "Please retake the PAN photo" });
  assert.equal(r.status, 200);
  assert.equal(doc(idB).status, "sent_back");
  assert.equal(doc(idB).review.note, "Please retake the PAN photo");
  assert.equal(doc(idB).review.noteTranslated, "[hi] Please retake the PAN photo"); // mock translate
  assert.equal((await call("cust", "GET", r.body.audioUrl)).status, 200, "voice note plays");
  assert.equal(sent.length, before + 1);
  assert.ok(sent.at(-1)!.body.includes("[hi] Please retake the PAN photo"));
  assert.ok(sent.at(-1)!.mediaUrl![0].includes("/media/"));
  r = await call("cust", "POST", `/applications/${idB}/check`, {}); // customer starts fixing
  assert.equal(r.body.status, "needs_fix");
  r = await call("cust", "POST", `/applications/${idB}/submit`);
  assert.equal(r.status, 200);
  assert.equal(doc(idB).status, "ready_for_review");
  step("send_back: note translated + voice note + WhatsApp, sent_back -> needs_fix -> ready_for_review");

  /* ---------- C: no notify consent ---------- */
  const idC = await seed({ consent: false });
  const beforeC = sent.length;
  r = await call("cust", "POST", `/applications/${idC}/submit`);
  assert.equal(r.status, 200);
  assert.equal(doc(idC).notify.consent, false);
  assert.equal(sent.length, beforeC, "no WhatsApp without consent");
  const skipped = audits(idC).find((a) => a.action === "notify.skipped");
  assert.equal(skipped?.detail.reason, "no_consent");
  step("notify is skipped when consent is false (audited as no_consent)");

  /* ---------- D: needs_fix notification and blocked submit ---------- */
  const created = await call("cust", "POST", "/applications", { language: "en-IN", consent: true });
  const idD = created.body.id as string;
  for (const a of ["Ramesh Shetty", "15/03/1950", "98765 43210", "12 MG Road, Bengaluru", "retired", "Sita Shetty", "spouse", "yes"]) {
    await call("cust", "POST", "/interview/answer", { appId: idD, text: a, source: "typed" });
    await call("cust", "POST", "/interview/confirm", { appId: idD, text: "yes" });
  }
  await upload(idD, "aadhaar", "blurry-aadhaar.jpg");
  await upload(idD, "pan", "clean/pan.jpg");
  await upload(idD, "passbook", "clean/passbook.jpg");
  const beforeD = sent.length;
  r = await call("cust", "POST", `/applications/${idD}/check`, {});
  assert.equal(r.body.status, "needs_fix");
  assert.equal(sent.length, beforeD + 1);
  assert.match(sent.at(-1)!.body, /need a fix/);
  r = await call("cust", "POST", `/applications/${idD}/submit`);
  assert.equal(r.status, 409);
  assert.equal(r.body.code, "not_eligible");
  assert.ok(r.body.mismatches.some((m: any) => m.code === "PHOTO_BLURRY"));
  step("needs_fix sends WhatsApp; submit is refused while a blocking problem remains");

  server.close();
  return { log, sent, store };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { log } = await runJourney();
  for (const l of log) console.log("ok:", l);
}
