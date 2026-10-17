// Seeds Firestore with ONE branch and 7 FAKE demo applications in different statuses and languages, so the bank
// screens, numbers and check-in can be shown without finishing a customer flow first.
//   npm run seed          (writes to the Firestore project in server/.env)
// Idempotent: every demo row has a fixed id (demo-*) and `demo: true`; running again replaces them. Real applications are
// never touched, and the retention cleanup ignores demo rows. Everything here is made-up data.
import { getAuth } from "firebase-admin/auth";
import sharp from "sharp";
import { createCtx } from "../src/app.js";
import { DEFAULT_BRANCH } from "../src/branch.js";
import { loadEnv } from "../src/env.js";
import { firebaseDeps } from "../src/firebase.js";
import { buildPdf } from "../src/routes/lifecycle.js";
import { computeMetrics } from "../src/services/metrics.js";
import { evaluate } from "../src/services/evaluate.js";
import { issueQr } from "../src/services/qr.js";
import { deleteApplication } from "../src/services/retention.js";
import { aadhaarLast4 } from "../src/services/validators.js";
import type { Doc } from "../src/store.js";
import { breakAadhaar, fakeAadhaar, renderCard, type Person } from "./lib/fake-docs.js";

const env = loadEnv();
const { store } = firebaseDeps(env);
const ctx = createCtx({ env, store });

const now = Date.now();
const ago = (min: number) => new Date(now - min * 60_000).toISOString();
const plus = (iso: string, min: number) => new Date(Date.parse(iso) + min * 60_000).toISOString();

interface Seed {
  id: string;
  lang: "en-IN" | "hi-IN" | "kn-IN";
  status: "docs_pending" | "needs_fix" | "ready_for_review" | "approved" | "sent_back" | "signed";
  /** Name as the customer said it (own script) and in English letters. */
  nameNative: string;
  person: Person;
  address: string;
  occupation: string;
  nominee: string;
  relation: string;
  notify: boolean;
  startedMinAgo: number;
  readyAfterMin?: number;
  docs: ("aadhaar" | "pan" | "passbook")[];
  panName?: string; // printed on the PAN when different
  blurryPassbook?: boolean;
  invalidAadhaar?: boolean;
  lowConfidencePassbook?: boolean;
  mistakes?: number;
  scamBlocks?: number;
  /** Shown score for the two showcase rows (the formula cannot produce 96 or 71 for these cases). */
  shownScore?: number;
  sentBackNote?: { en: string; translated: string };
}

const p = (name: string, dob: string, base11: string, pan: string, ifsc: string, acct: string): Person => ({
  name, dob, dobPrinted: dob.split("-").reverse().join("/"), aadhaar: fakeAadhaar(base11), pan, ifsc, account: acct,
});

const SEEDS: Seed[] = [
  { id: "demo-savitri", lang: "kn-IN", status: "ready_for_review", nameNative: "ಸಾವಿತ್ರಿ ರಾವ್", person: p("Savitri Rao", "1948-07-02", "36481952076", "BKLPR4521D", "SDBK0001234", "0012000111"),
    address: "14 Temple Road, Udupi", occupation: "retired", nominee: "Ganesh Rao", relation: "son", notify: true, startedMinAgo: 40, readyAfterMin: 11, docs: ["aadhaar", "pan", "passbook"], shownScore: 96 },
  { id: "demo-mohammed", lang: "hi-IN", status: "needs_fix", nameNative: "मोहम्मद रफ़ी", person: p("Mohammed Rafi", "1952-11-21", "58264013978", "CMRPR8830K", "SDBK0001234", "0012000222"),
    address: "7 Market Lane, Manipal", occupation: "business", nominee: "Zareena Rafi", relation: "spouse", notify: true, startedMinAgo: 80, docs: ["aadhaar", "pan", "passbook"],
    panName: "RAFI MOHAMMED K", blurryPassbook: true, lowConfidencePassbook: true, mistakes: 2, scamBlocks: 1, shownScore: 71 },
  { id: "demo-lakshmi", lang: "kn-IN", status: "approved", nameNative: "ಲಕ್ಷ್ಮಿ ನಾಯಕ್", person: p("Lakshmi Naik", "1946-01-30", "27391846502", "DNLPN2290F", "SDBK0001234", "0012000333"),
    address: "3 Beach Road, Malpe", occupation: "homemaker", nominee: "Ramesh Naik", relation: "son", notify: true, startedMinAgo: 26 * 60, readyAfterMin: 9, docs: ["aadhaar", "pan", "passbook"] },
  { id: "demo-arun", lang: "hi-IN", status: "sent_back", nameNative: "अरुण कुमार", person: p("Arun Kumar", "1955-05-09", "49017382645", "EARPK7714M", "SDBK0001234", "0012000444"),
    address: "22 Station Road, Udupi", occupation: "salaried", nominee: "Meena Kumar", relation: "spouse", notify: false, startedMinAgo: 30 * 60, readyAfterMin: 14, docs: ["aadhaar", "pan", "passbook"], panName: "ARUN KUMAR S", mistakes: 1,
    sentBackNote: { en: "Please retake the PAN card photo; the name is cut off.", translated: "कृपया पैन कार्ड की फ़ोटो दोबारा लें; नाम कटा हुआ है।" } },
  { id: "demo-geeta", lang: "en-IN", status: "signed", nameNative: "Geeta Hegde", person: p("Geeta Hegde", "1949-09-17", "63820174958", "FGHPH5566L", "SDBK0001234", "0012000555"),
    address: "9 Garden Street, Kundapur", occupation: "retired", nominee: "Sunil Hegde", relation: "son", notify: true, startedMinAgo: 52 * 60, readyAfterMin: 8, docs: ["aadhaar", "pan", "passbook"], mistakes: 1 },
  { id: "demo-prakash", lang: "kn-IN", status: "ready_for_review", nameNative: "ಪ್ರಕಾಶ್ ಶೆಣೈ", person: p("Prakash Shenoy", "1951-03-25", "74195028361", "GHPPS9087N", "SDBK0001234", "0012000666"),
    address: "5 Mill Road, Karkala", occupation: "farmer", nominee: "Rekha Shenoy", relation: "spouse", notify: true, startedMinAgo: 25, readyAfterMin: 13, docs: ["aadhaar", "pan", "passbook"], panName: "PRAKASH K SHENOY", mistakes: 1 },
  { id: "demo-sunita", lang: "en-IN", status: "docs_pending", nameNative: "Sunita Patil", person: p("Sunita Patil", "1957-12-04", "85203917460", "HJSPP3345Q", "SDBK0001234", "0012000777"),
    address: "11 Lake View, Udupi", occupation: "homemaker", nominee: "Anil Patil", relation: "son", notify: true, startedMinAgo: 180, docs: ["aadhaar"] },
];

const conf = (value: unknown, valueEn?: string) => ({ value, valueEn: valueEn ?? String(value), confidence: 1, confirmed: true });

async function build(s: Seed) {
  const started = ago(s.startedMinAgo);
  const ready = s.readyAfterMin !== undefined ? plus(started, s.readyAfterMin) : undefined;
  const person = s.invalidAadhaar ? { ...s.person, aadhaar: breakAadhaar(s.person.aadhaar) } : s.person;

  // answers (own script for hi / kn customers, English transliteration in valueEn)
  const answers = {
    full_name: conf(s.nameNative, s.person.name),
    dob: conf(s.person.dob),
    mobile: conf(`90000${s.id.length}${String(s.startedMinAgo).padStart(4, "0")}`.slice(0, 10)),
    address: conf(s.address),
    occupation: conf(s.occupation),
    nominee_name: conf(s.nominee),
    nominee_relation: conf(s.relation),
    notify_consent: conf(s.notify),
  };

  // documents
  const documents: Record<string, Doc> = {};
  const images: Record<string, Buffer> = {};
  const c95 = { name: 0.95, dob: 0.95, number: 0.95, ifsc: 0.95 };
  for (const kind of s.docs) {
    const uploadedAt = plus(started, 5);
    if (kind === "aadhaar") {
      documents.aadhaar = { fields: { name: person.name, dob: person.dob }, confidence: c95, aadhaarLast4: aadhaarLast4(person.aadhaar), valid: !s.invalidAadhaar, blurry: false, uploadedAt };
      images.aadhaar = await renderCard("aadhaar", person);
    } else if (kind === "pan") {
      const printed = s.panName ?? person.name.toUpperCase();
      documents.pan = { fields: { name: printed, dob: person.dob, pan: person.pan }, confidence: c95, valid: true, blurry: false, uploadedAt };
      images.pan = await renderCard("pan", person, printed);
    } else {
      const printed = `Mr ${person.name}`;
      documents.passbook = {
        fields: { name: printed, ifsc: person.ifsc },
        confidence: { ...c95, name: s.lowConfidencePassbook ? 0.72 : 0.95, ifsc: s.blurryPassbook ? 0.55 : 0.95 },
        valid: !s.blurryPassbook, blurry: !!s.blurryPassbook, uploadedAt,
      };
      const card = await renderCard("passbook", person, printed);
      images.passbook = s.blurryPassbook ? await sharp(card).blur(9).jpeg({ quality: 80 }).toBuffer() : card;
    }
  }

  const app: Doc = {
    demo: true,
    customerUid: "demo-customer",
    branchId: DEFAULT_BRANCH.id,
    language: s.lang,
    status: s.status,
    consent: { at: started, version: 1 },
    answers,
    documents,
    mismatches: [],
    readiness: { score: 0, items: [] },
    notify: { phone: s.notify ? String(answers.mobile.value) : null, consent: s.notify },
    metrics: { startedAt: started, ...(ready ? { readyAt: ready } : {}), mistakesCaught: s.mistakes ?? 0, scamBlocks: s.scamBlocks ?? 0, ...(s.sentBackNote ? { sentBackCount: 1 } : {}) },
    interview: { attempts: 0 },
    createdAt: started,
    updatedAt: ago(Math.max(1, s.startedMinAgo - (s.readyAfterMin ?? 5))),
  };

  // checks + readiness from the real rules; the two showcase rows show the requested score
  const ev = evaluate(app);
  app.mismatches = ev.mismatches;
  app.readiness = { score: s.shownScore ?? ev.readiness.score, items: ev.readiness.items, quickApprove: s.shownScore ? s.shownScore >= 90 && ev.readiness.items.find((i) => i.id === "docs")!.done : ev.readiness.quickApprove, eligible: ev.eligible, ...(s.shownScore ? { demoScore: true } : {}) };

  // decisions
  if (s.status === "approved" || s.status === "signed") {
    const approvedAt = plus(ready!, s.status === "signed" ? 90 : 25);
    const qr = await issueQr(env.QR_JWT_SECRET, s.id);
    app.review = { decision: "approved", note: null, at: approvedAt, by: "demo" };
    app.qr = { jti: qr.jti, expiresAt: qr.expiresAt, usedAt: null, token: qr.token };
    app.metrics = { ...app.metrics, approvedAt };
    if (s.status === "signed") {
      const signedAt = plus(approvedAt, 60);
      app.qr = { ...app.qr, usedAt: signedAt };
      app.metrics = { ...app.metrics, signedAt };
    }
  }
  if (s.status === "sent_back" && s.sentBackNote) {
    app.review = { decision: "sent_back", note: s.sentBackNote.en, noteTranslated: s.sentBackNote.translated, at: plus(ready!, 40), by: "demo" };
  }
  return { app, images, started, ready };
}

async function writeSeed(s: Seed) {
  await deleteApplication(store, s.id); // idempotent: start clean
  const { app, images, started, ready } = await build(s);
  await store.set(`applications/${s.id}`, app);
  for (const [kind, img] of Object.entries(images)) await ctx.files.put(s.id, kind as "aadhaar", img, "image/jpeg", { precompressed: true });

  if (s.status === "signed") {
    const sig = await sharp({ create: { width: 300, height: 100, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
      .composite([{ input: await sharp({ create: { width: 200, height: 5, channels: 4, background: "#102a43" } }).png().toBuffer(), left: 40, top: 55 }])
      .png().toBuffer();
    await ctx.files.put(s.id, "signature", sig, "image/png");
  }
  if (["ready_for_review", "approved", "sent_back", "signed"].includes(s.status)) await buildPdf(ctx, s.id, app);

  // a believable audit trail (fixed demo actor, no secrets)
  const log = async (at: string, action: string, detail: Record<string, unknown> = {}) => void (await store.add(`applications/${s.id}/audit`, { at, actor: "demo", action, detail }));
  await log(started, "application.create", { language: s.lang });
  await log(started, "consent.given", { version: 1 });
  for (const kind of s.docs) await log(plus(started, 5), "document.extract", { kind });
  await log(plus(started, 6), "application.check", { codes: (app.mismatches as { code: string }[]).map((m) => m.code), score: app.readiness.score });
  if (ready) await log(ready, "application.submit", { score: app.readiness.score });
  if (app.review?.decision === "approved") await log(app.review.at, "review.approve", {});
  if (app.review?.decision === "sent_back") await log(app.review.at, "review.send_back", {});
  if (app.metrics.signedAt) await log(app.metrics.signedAt, "application.sign", {});
}

// ---- run ----
await store.set(`branches/${DEFAULT_BRANCH.id}`, { ...DEFAULT_BRANCH });
console.log(`branch: ${DEFAULT_BRANCH.name}`);
for (const s of SEEDS) {
  await writeSeed(s);
  const a = (await store.get(`applications/${s.id}`))!;
  console.log(`  ${s.id.padEnd(14)} ${s.person.name.padEnd(16)} ${s.lang}  ${s.status.padEnd(17)} readiness ${String(a.readiness.score).padStart(3)}${a.readiness.quickApprove ? "  quick-approve" : ""}`);
}

const all = (await store.list("applications")).map((d) => d.data);
const m = computeMetrics(all, { baselineMinutes: env.BASELINE_MANUAL_MINUTES });
console.log(`\n${SEEDS.length} demo applications written (marked demo: true). Numbers page will show: today ${m.tiles.applicationsToday}, first-visit approval ${m.tiles.firstVisitApprovalRate ?? "-"}%, avg ${m.tiles.averageMinutes ?? "-"} min.`);

// ---- how to use your banker account ----
const auth = getAuth();
const users = (await auth.listUsers(1000)).users.filter((u) => !!u.email);
const bankers = users.filter((u) => u.customClaims?.role === "banker");
console.log("\nBank screens: open <your web URL>/bank");
if (bankers.length) {
  console.log(`  Sign in with your banker account: ${bankers.map((u) => u.email).join(", ")} (the password you set in Firebase Authentication).`);
} else if (users.length) {
  console.log(`  No account has the banker claim yet. Accounts with an email: ${users.map((u) => u.email).join(", ")}`);
  console.log("  Give one the claim:  npm run set-banker -- <email>   then sign out and in again.");
} else {
  console.log("  No email/password account exists yet: add one in Firebase console > Authentication > Users, then  npm run set-banker -- <email>");
}
console.log("  Check-in demo: the approved demo application's QR token:  npm run decide -- demo-lakshmi token   (paste it on the Check-in page)");
console.log("  Re-run `npm run seed` any time to reset the demo rows.");
