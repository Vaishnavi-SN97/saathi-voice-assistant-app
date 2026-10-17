// Acts as the bank on a real application (Firestore from server/.env), so you can watch the customer app update live.
//   npm run decide -- <appId> approve ["note"]
//   npm run decide -- <appId> send_back "English note"
//   npm run decide -- <appId> sign          (marks it signed at the branch, with a sample signature)
//   npm run decide -- <appId> show          (prints status only)
//   npm run decide -- <appId> token         (prints the approved application's QR token: paste it into the bank check-in page)
// The application must be in the right status (approve / send_back need ready_for_review, sign needs approved).
import sharp from "sharp";
import { createCtx } from "../src/app.js";
import { loadEnv } from "../src/env.js";
import { firebaseDeps } from "../src/firebase.js";
import { approveApplication, sendBackApplication, signApplication } from "../src/routes/lifecycle.js";

const [appId, action, ...rest] = process.argv.slice(2);
if (!appId || !["approve", "send_back", "sign", "show", "token"].includes(action ?? "")) {
  console.error('Usage: npm run decide -- <appId> approve|send_back|sign|show|token ["note"]');
  process.exit(1);
}

const env = loadEnv();
const { store } = firebaseDeps(env);
const ctx = createCtx({ env, store });
const app = await store.get(`applications/${appId}`);
if (!app) { console.error(`No application ${appId}`); process.exit(1); }
console.log(`before: status=${app.status}`);

try {
  if (action === "approve") {
    const r = await approveApplication(ctx, "system", appId, app, rest.join(" ") || undefined);
    console.log(`approved. QR expires ${r.qr.expiresAt}`);
  } else if (action === "send_back") {
    const note = rest.join(" ").trim();
    if (note.length < 3) throw new Error('send_back needs an English note, e.g. "Please retake the PAN photo"');
    const r = await sendBackApplication(ctx, "system", appId, app, note);
    console.log(`sent back. Customer sees: ${r.noteTranslated}`);
  } else if (action === "sign") {
    const sig = await sharp({ create: { width: 300, height: 100, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
      .composite([{ input: await sharp({ create: { width: 220, height: 6, channels: 4, background: "#102a43" } }).png().toBuffer(), left: 30, top: 50 }])
      .png().toBuffer();
    const r = await signApplication(ctx, "system", appId, app, sig);
    console.log(`signed at ${r.signedAt}`);
  }
  if (action === "token") {
    if (!app.qr?.token) throw new Error("No QR token yet: the application must be approved first");
    console.log(app.qr.usedAt ? "(already used)" : "QR token (valid until " + app.qr.expiresAt + "):");
    console.log(app.qr.token);
  }
  console.log(`after:  status=${(await store.get(`applications/${appId}`))!.status}`);
} catch (e) {
  console.error("Failed:", (e as Error).message);
  process.exit(1);
}
