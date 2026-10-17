# SAATHI: PRO-PLAN PROMPTS (smallest possible token use)

## Honest note first
No one can promise that a full-stack build fits inside Claude Pro limits, because limits depend on how busy the models are and on your plan's rolling window and weekly cap. These prompts are designed to use as little as possible, and they are built so that **progress is saved to GitHub after every step**. If you hit a limit, nothing is lost: wait for the reset, open a new chat, paste RESUME, and continue.

## What makes this version cheap
- **Smaller project shape:** plain `npm` (no pnpm workspaces), two folders only: `server/` (Express, run with `tsx`, no build step) and `web/` (React + Vite; customer app at `/`, banker dashboard at `/bank`). Fewer config files, fewer build errors.
- **13 micro-tasks, each one new chat.** Long chats re-send their whole history on every step, which is the biggest hidden cost.
- **No Playwright, no screenshots, no docs crawling, no sub-agents, no long reports.** Tests are small Node scripts and `curl`. YOU click through the app for 2 minutes after each step (cheaper and better at catching real problems).
- **Every prompt** tells Claude Code: do not explore, do not print files, do not explain, replies of 5 lines or fewer.
- **Features cut to the essentials:** no n8n (Twilio direct), no kiosk, no PWA install, no metrics charts, no pre-generation script (TTS is generated on first use and cached), no family mode.

## How to use
1. Replace `SPEC.md` in your project folder with the box in **STEP 1** (it is shorter than the old one).
2. Put your `.env` files in place when P0 tells you the folders exist (see the end of this file).
3. For each prompt: **new chat** → paste → wait for DONE and the GitHub push → test by hand for 2 minutes → next.
4. Check your usage now and then (try the `/usage` command if your version has it). If you are close to the limit, finish the current prompt, then pause until reset.

Priority if you run low: P0 to P6 (backend) → P7 to P9 (customer app) → P10 (banker approve) → P12 (deploy) → P11 (check-in and tiles).

---

## STEP 1: SPEC.md (replace the old one with this)

```
# SAATHI SPEC

Product: voice-first assistant that helps seniors fill a bank savings-account form in Hindi, Kannada or English. One question at a time, read back to confirm, check Aadhaar/PAN/passbook photos for mismatches, fill the bank form PDF, banker approves or sends back, customer gets WhatsApp update + QR and signs at branch.
Rules: AI proposes, rules decide. Human approves and signs. Never ask for OTP/PIN (scam shield in code). Fake data only. Store only last 4 digits of Aadhaar. Secrets only in server/.env; the browser never calls Sarvam/Gemini/Twilio. Never print or commit secrets.

Shape: npm, two folders. server/ = Node 20 + Express + TypeScript run with tsx (no build step). web/ = React + Vite + TS + Tailwind. The customer app is the 8 existing screens in this folder (language, consent, interview, document camera, problems found, readiness, status, QR): move them into web/, keep their look. Banker dashboard = routes under /bank in the same web app.

Firebase (project saathi-f5b30) FREE plan: Anonymous auth for customers (no OTP); Email/Password for bankers with custom claim role=banker. Firestore only; NO Storage. Files in Firestore: applications/{id}/files/{kind} (aadhaar|pan|passbook|signature|pdf) as bytes + mime; compress photos with sharp (max 1280px, JPEG q70, under 900 KB). Serve files only through authenticated GET /files/:appId/:kind. Audio: tts(text,lang) caches the mp3 in Firestore media/{sha1(text+lang+voice)} and returns a URL GET /media/:id?token=<10-min JWT> (public with token, so Twilio can fetch). Firestore rules: client may read own application (customerUid==uid) or if banker; no client writes.

Statuses: draft -> docs_pending -> needs_fix -> ready_for_review -> approved | sent_back -> signed (sent_back -> needs_fix after fixes).
Application: customerUid, language(hi-IN|kn-IN|en-IN), status, consent{at,version}, answers{fieldId:{value,valueEn,confirmed,confidence}}, documents{aadhaar|pan|passbook:{fields,confidence,aadhaarLast4,valid,blurry}}, mismatches[{code,severity,message{en,hi,kn}}], readiness{score,items[]}, review{decision,note,noteTranslated,at}, qr{jti,expiresAt,usedAt}, notify{phone,consent}, metrics{startedAt,readyAt,approvedAt,signedAt,mistakesCaught,scamBlocks}. Subcollection audit{at,actor,action,detail} (never secrets/OTPs/full ID numbers).

Form (server/data/form.json; prompts in en/hi/kn): full_name(name), dob(date, age 18-110), mobile(10 digits, starts 6-9), address(text), occupation(choice: retired, homemaker, farmer, business, salaried, other), nominee_name(name), nominee_relation(choice: spouse, son, daughter, other), notify_consent(yes/no). Documents: aadhaar, pan, passbook.

API (Bearer Firebase ID token): GET /health; POST /applications; POST /voice/stt; POST /tts; POST /interview/answer; POST /interview/confirm; POST /documents/extract; POST /applications/:id/check; POST /applications/:id/submit; POST /applications/:id/pdf; POST /applications/:id/review (banker); POST /checkin/verify; POST /applications/:id/sign; GET /files/:appId/:kind; GET /media/:id.

Logic:
- Scam shield on every transcript/typed answer: block OTP, PIN, CVV, password, passcode, MPIN, UPI PIN, card number (also ओटीपी, पिन, पासवर्ड, ಒಟಿಪಿ, ಪಿನ್, ಪಾಸ್‌ವರ್ಡ್) or those words with a 4-6 digit sequence. Blocked: store nothing, metrics.scamBlocks++, audit without content, return warning audio "Never share your OTP or PIN with anyone, not even with us."
- Interview: deterministic state machine over form.json: next = first required unconfirmed field. Answer -> scam shield -> Gemini extract (JSON, temp 0: value, English transliteration, confidence, current field only) -> validate -> read-back -> yes/no (yes: हाँ, हां, सही, ಹೌದು, ಸರಿ, yes, correct, ok; no: नहीं, ना, ಇಲ್ಲ, ತಪ್ಪು, no). Max 2 retries if confidence<0.6 or invalid, then offer typing. After last field -> docs_pending. LLM never picks the next question.
- Validators: Aadhaar 12 digits, first 2-9, Verhoeff; PAN ^[A-Z]{5}[0-9]{4}[A-Z]$ with 4th letter P; IFSC ^[A-Z]{4}0[A-Z0-9]{6}$; mobile ^[6-9]\d{9}$. Keep only aadhaarLast4 + valid.
- Name match on English transliterations: lowercase, strip punctuation, expand single-letter initials, sort tokens, Jaro-Winkler: >=0.93 match, 0.80-0.93 spelled_differently (warn), else mismatch (block). DOB exact. Compare answers vs Aadhaar vs PAN vs passbook holder.
- Mismatch codes (messages en/hi/kn): NAME_SPELLED_DIFFERENTLY, NAME_MISMATCH, DOB_MISMATCH, AADHAAR_INVALID, PAN_INVALID, IFSC_INVALID, PHOTO_BLURRY, DOC_MISSING.
- Readiness 0-100: required answers confirmed 35; 3 docs uploaded+clear 20; names match 15; DOB matches 10; Aadhaar/PAN/IFSC valid 10; nominee complete 5; consent 5. items[] with plain to-dos. 90+ = quick-approve badge.
- PDF: pdf-lib, generate a clean savings-account form, English transliterations, footer "Prepared by Saathi. Pending bank verification and customer signature."
- Approve: JWT {aid,jti} HS256 QR_JWT_SECRET, 3-day expiry, QR image via qrcode, jti single use. Send back: English note -> Sarvam translate -> tts -> notify.
- Notify (Twilio WhatsApp direct, from whatsapp:TWILIO_WHATSAPP_FROM, text + mp3 via mediaUrl): only if notify consent. Triggers: needs_fix, ready_for_review, approved, sent_back, signed.

Integrations: Sarvam https://api.sarvam.ai header api-subscription-key: POST /speech-to-text (multipart file; model saaras:v4; mode transcribe), POST /text-to-speech (JSON text, language_code hi-IN|kn-IN|en-IN, model bulbul:v3, speaker e.g. priya, pace, output_audio_codec mp3; response audios[] base64), POST /translate (input, source_language_code auto, target_language_code -> translated_text). Gemini: @google/genai, model from GEMINI_MODEL, JSON output, on 429 retry then GEMINI_API_KEY_BACKUP. Only if a call fails unexpectedly, fetch the official docs ONCE; otherwise never browse.
MOCK_AI=true returns canned STT/Gemini/TTS so everything runs without keys.

Env server/.env: PORT, CORS_ORIGINS, PUBLIC_API_URL, SARVAM_API_KEY, GEMINI_API_KEY, GEMINI_API_KEY_BACKUP, GEMINI_MODEL, FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM, NOTIFY_MODE(direct|off), MOCK_AI, QR_JWT_SECRET, BASELINE_MANUAL_MINUTES. web/.env: VITE_API_URL, VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_APP_ID.

UI: keep existing look. teal #0E7C86, navy #1F3A5F, bg #FAF7F2, amber #E8A317, green #2E8B57. Text 18px+, buttons 64px, safe-area padding (env(safe-area-inset-*), viewport-fit=cover), @fontsource Noto Sans / Devanagari / Kannada (self-hosted). Speaker button by spoken text; "talk to a person" link on each screen.
```

## RULES LINE (already inside every prompt below)
"Do not explore the repo beyond files you need. Do not print file contents. Do not explain or summarise beyond 5 lines. No Playwright, no screenshots, no web browsing."

---

## P0: Scaffold and GitHub

```
Read SPEC.md only. No exploring beyond what you need, no printing files, replies <=5 lines, no Playwright/screenshots/browsing.
TASK P0: scaffold + GitHub.
1) List the folder (names only). Find my 8 existing screens; tell me their framework in one line.
2) Create server/ (package.json with express, cors, helmet, zod, dotenv, firebase-admin, @google/genai, axios, form-data, sharp, fluent-ffmpeg, ffmpeg-static, pdf-lib, qrcode, jsonwebtoken, multer, twilio, tsx, typescript; scripts: dev, test using node:test via tsx) with src/index.ts serving GET /health. Create web/ by moving my screens in (convert to React+Vite+TS+Tailwind only if not already). Root: .gitignore (.env, node_modules, dist, service-account json), .env.example files with blank values, README.md, PROGRESS.md.
3) npm install in both; confirm server /health works and the web app builds.
4) git init (main) if needed; create a PRIVATE GitHub repo "saathi" with gh (if gh is not logged in, give me the commands and wait). Confirm `git status` shows no secrets or .env.
Commit "P0 scaffold", `git push -u origin main`. Reply DONE in <=5 lines.
```

## P1: Server base (Firebase, auth, files, media)

```
Read SPEC.md only. Same rules: no exploring, no printing files, replies <=5 lines, no Playwright/screenshots/browsing.
TASK P1: server base in server/src. Build: env loading; Express (cors from CORS_ORIGINS, helmet, JSON limit, error handler {error,code}); Firebase Admin from env; auth middleware (verify ID token -> uid, role); audit helper; status-transition function with the allowed transitions; FileStore (put/get into Firestore bytes at applications/{id}/files/{kind}, sharp compression, <900 KB) and GET /files/:appId/:kind with access checks (owner or banker); media store + tts cache hooks + GET /media/:id?token=; MOCK_AI switch with a small mock module; data/form.json (en/hi/kn prompts; list Hindi/Kannada strings needing a native check in PROGRESS.md); POST /applications (draft, consent, first question); firestore.rules file; scripts/set-banker-claim.ts.
Test (small node:test file + one script): transition function allows/rejects correctly; unauthenticated call -> 401; creating an application with an anonymous token writes an audit entry; a 1.5 MB test image compresses under 900 KB.
Commit "P1 server base", push. DONE in <=5 lines.
```

## P2: Voice services and scam shield

```
Read SPEC.md only. Same rules: no exploring, no printing files, replies <=5 lines, no Playwright/screenshots/browsing.
TASK P2: server/src/services: sarvam.ts (stt, tts, translate per SPEC; one female voice that works in hi-IN, kn-IN, en-IN; pace support; ttsCached(text,lang,pace) using the media store), audio-convert.ts (any format -> 16 kHz mono wav via ffmpeg-static), scam-shield.ts. Routes: POST /voice/stt (multipart audio -> wav -> Sarvam -> scam shield) and POST /tts.
Test: node:test for the scam shield (include "my OTP is 4 8 2 9 1 7" and a Hindi one); with MOCK_AI=true both routes respond; if keys exist, one real tts call then feed that audio to stt and check the transcript is sensible.
Commit "P2 voice", push. DONE in <=5 lines incl. what was real vs mocked.
```

## P3: Interview engine

```
Read SPEC.md only. Same rules: no exploring, no printing files, replies <=5 lines, no Playwright/screenshots/browsing.
TASK P3: server/src/services: gemini.ts extractAnswer (JSON output, temperature 0, retry then backup key), interview-engine.ts (state machine per SPEC, yes/no classifier, retries, typing fallback, read-back sentences in en/hi/kn), routes POST /interview/answer and POST /interview/confirm. Scam shield runs first. Last field -> docs_pending.
Test: node:test for the yes/no classifier and the next-field logic; one script that completes the whole interview with typed answers under MOCK_AI=true; saying no then a new value replaces the old one; an OTP phrase is blocked and nothing is stored.
Commit "P3 interview", push. DONE in <=5 lines.
```

## P4: Validators, matcher, readiness (pure code)

```
Read SPEC.md only. Same rules: no exploring, no printing files, replies <=5 lines, no Playwright/screenshots/browsing.
TASK P4: server/src/services: validators.ts (Aadhaar with Verhoeff, PAN, IFSC, mobile, age), matcher.ts (name + DOB per SPEC, own Jaro-Winkler implementation), mismatches.ts (all codes with en/hi/kn messages), readiness.ts (exact weights in SPEC, items[] with plain to-dos).
Test with node:test: Verhoeff with generated valid/invalid numbers; "Ramesh Shetty" vs "Ramesh K Shetty" -> spelled_differently; "E Yashwanth Kumar" vs "Yashwanth Kumar E" -> match; clearly different names -> mismatch; readiness score for a full clean case is >=90 and for a missing-doc case is lower with a to-do.
Commit "P4 validators matcher readiness", push. DONE in <=5 lines.
```

## P5: Documents and checks

```
Read SPEC.md only. Same rules: no exploring, no printing files, replies <=5 lines, no Playwright/screenshots/browsing.
TASK P5: gemini.ts extractDoc (aadhaar/pan/passbook -> JSON with per-field confidence and blurry flag; "never guess, null if unclear"); routes POST /documents/extract (multipart, images only, 8 MB, save via FileStore, keep only aadhaarLast4 + valid) and POST /applications/:id/check (run matcher + validators, store mismatches + readiness, update status to needs_fix or ready_for_review-eligible, count mistakesCaught). Add scripts/make-fake-docs.ts that draws FAKE document images with sharp/SVG into server/assets/demo-docs: a clean set (aadhaar, pan, passbook) for one made-up person, a name-variant set, one blurry image, one invalid-number image.
Test: script runs extract + check on the clean set (score >=90, no mismatches) and on the name-variant set (NAME_SPELLED_DIFFERENTLY); works under MOCK_AI=true; if GEMINI keys exist, try one real extraction and say how it did.
Commit "P5 documents", push. DONE in <=5 lines.
```

## P6: PDF, review, QR, sign, notifications

```
Read SPEC.md only. Same rules: no exploring, no printing files, replies <=5 lines, no Playwright/screenshots/browsing.
TASK P6: pdf-fill.ts (pdf-lib form per SPEC, saved via FileStore kind pdf); routes POST /applications/:id/pdf, /submit (-> ready_for_review, metrics.readyAt), /review (banker only: approve issues JWT QR + qrcode image and stores jti; send_back translates the note with Sarvam, makes mp3 with ttsCached, sets sent_back), POST /checkin/verify, POST /applications/:id/sign (stores signature via FileStore, marks jti used, status signed); notify.ts (NOTIFY_MODE direct|off, Twilio WhatsApp text + mp3 via mediaUrl = PUBLIC_API_URL/media/:id?token=..., only with notify consent) triggered on needs_fix, ready_for_review, approved, sent_back, signed. Audit every action and record metrics timestamps.
Test (one script): seeded application goes submit -> approve -> verify QR -> sign; a second verify of the same QR is rejected; a non-banker calling /review gets 403; notify is skipped when consent is false; PDF page 1 text contains the entered values.
Commit "P6 pdf review qr notify", push. DONE in <=5 lines.
```

## P7: Web setup + language, consent, interview screens

```
Read SPEC.md only. Same rules: open only the screen files you need, no printing files, replies <=5 lines, no Playwright/screenshots/browsing. Keep my existing design.
TASK P7 (web/): Firebase anonymous sign-in; api client that sends the ID token; i18n (en, hi, kn) with a language switcher; self-hosted Noto fonts; safe-area padding and viewport-fit=cover; routing for the 8 screens; wire the language + consent screens to POST /applications; wire the interview screen: MediaRecorder (12 s max, tap to stop, level meter) -> POST /voice/stt -> /interview/answer -> read-back confirm card (Yes / No, say again) -> /interview/confirm, type-instead fallback, listen again, speak slower, scam-warning banner state. Loading and error states on every call.
Test: `npm run build` passes; grep the build output for key-like strings (none); tell me the exact 3-step manual click test to try (I will test by hand).
Commit "P7 web interview", push. DONE in <=5 lines.
```

## P8: Web camera, problems, readiness screens

```
Read SPEC.md only. Same rules: open only the screen files you need, no printing files, replies <=5 lines, no Playwright/screenshots/browsing. Keep my existing design.
TASK P8 (web/): document camera (rear camera, guide frame, on-phone blur check with Laplacian variance on a downscaled canvas, preview Use/Retake, upload to POST /documents/extract, show issues); problems screen driven by mismatches with a speaker button on each and a direct action (choose the correct spelling or retake); readiness screen with score ring and checklist from the API, then POST /submit. Loading, error, camera-denied and offline messages.
Test: `npm run build` passes; give me the manual click test using the fake images in server/assets/demo-docs (upload them from my gallery/file picker if camera is unavailable on desktop: add a "choose file" fallback).
Commit "P8 web documents", push. DONE in <=5 lines.
```

## P9: Web status, QR, done screens

```
Read SPEC.md only. Same rules: open only the screen files you need, no printing files, replies <=5 lines, no Playwright/screenshots/browsing. Keep my existing design.
TASK P9 (web/): status screen with a vertical timeline fed by a Firestore onSnapshot listener on the application, branch card, notify-consent toggle; QR screen showing the real QR when approved; a simple Done screen; "talk to a person" link on every screen.
Test: build passes; give me the manual test: approve an application from the server script and watch the status screen update live.
Commit "P9 web status qr", push. DONE in <=5 lines.
```

## P10: Banker app: login, queue, detail, approve/send back

```
Read SPEC.md only. Same rules: no exploring beyond what you need, no printing files, replies <=5 lines, no Playwright/screenshots/browsing.
TASK P10 (web/ under /bank, same tokens as the customer app): login (Firebase email/password; require role=banker claim), live queue via Firestore onSnapshot sorted by readiness with status chips and a green quick-approve badge at 90+, application detail (document images fetched from GET /files/:appId/:kind with the ID token and shown as blob URLs; extracted fields with confidence, under 0.8 highlighted amber; masked Aadhaar; mismatches; PDF view; audit list), Approve and Send back (English reason box).
Test: build passes; give me the manual test (log in with my banker account, approve one application, see it change).
Commit "P10 bank queue detail", push. DONE in <=5 lines.
```

## P11: Banker check-in, signature, number tiles

```
Read SPEC.md only. Same rules: no exploring beyond what you need, no printing files, replies <=5 lines, no Playwright/screenshots/browsing.
TASK P11 (web/ under /bank): check-in page (html5-qrcode scanner plus a paste-token box, summary from /checkin/verify, signature_pad, Complete calling /sign); metrics page with number tiles only (applications today, first-visit approval rate, average minutes vs BASELINE_MANUAL_MINUTES, mistakes caught, scam blocks) labelled "demo data" for seeded rows; add GET /metrics on the server.
Test: build passes; give me the manual test.
Commit "P11 bank checkin metrics", push. DONE in <=5 lines.
```

## P12: Seed, deploy, docs

```
Read SPEC.md only. Same rules: no exploring beyond what you need, no printing files, replies <=6 lines, no Playwright/screenshots/browsing.
TASK P12: scripts/seed.ts (idempotent): one branch, 7 applications in different statuses/languages with fake data (one 96% ready, one 71%, one approved, one sent back, one signed) and metrics timestamps; print how to use my existing banker account. Deploy with the CLIs that are logged in: server to Railway (or Render), web to Vercel; set env vars from the .env files WITHOUT printing values; set CORS_ORIGINS and PUBLIC_API_URL; tell me which Firebase authorised domains to add. If a CLI is not logged in, write exact manual steps in DEPLOY.md. Add DEPLOY.md, a short README.md, and DEMO.md (3-minute click path with exact phrases, which fake documents to use, backup table for Wi-Fi/Sarvam/Gemini/WhatsApp/server failure, MOCK_AI=true as emergency switch). Add retention cleanup: delete files after signing and abandoned applications after 7 days.
Test: a script that runs the main journey against the deployed API under MOCK_AI=false if keys exist; deployed /health ok; secret scan of the repo finds nothing.
Commit "P12 seed deploy docs", push, tag v1.0. DONE with the URLs.
```

---

## Small helper prompts (new chat each)

### RESUME
```
Read SPEC.md and PROGRESS.md; run `git log --oneline -6` and `git status` only. Tell me in 4 lines what is done, what is half-done, what is broken, and the next step. Then finish only the unfinished task from SAATHI_PRO_PROMPTS.md. Replies <=5 lines. Commit and push when done.
```

### FIX A BUG
```
Read SPEC.md. Bug: <what you did / expected / got + the error text>. Find the root cause, fix it, add one small test, run only that test and the build, commit "fix: ...", push. Reply in 3 lines.
```

### RUNNING OUT OF LIMIT OR TIME
```
Read SPEC.md. I have <N> minutes left or a small usage limit. Without breaking the main journey (interview, document check, readiness, banker approve, status, QR) cut anything else: skip metrics tiles, signature pad (use a "Mark signed" button), Kannada polish. Finish, build once, commit, push. Tell me what you cut in 3 lines.
```

---

## .env files (create after P0, same as before but with the new folder names)

`server/.env`
```
PORT=8080
CORS_ORIGINS=http://localhost:5173
PUBLIC_API_URL=http://localhost:8080
SARVAM_API_KEY=
GEMINI_API_KEY=
GEMINI_API_KEY_BACKUP=
GEMINI_MODEL=
FIREBASE_PROJECT_ID=saathi-f5b30
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_FROM=
NOTIFY_MODE=direct
MOCK_AI=false
QR_JWT_SECRET=
BASELINE_MANUAL_MINUTES=30
```

`web/.env`
```
VITE_API_URL=http://localhost:8080
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=saathi-f5b30.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=saathi-f5b30
VITE_FIREBASE_APP_ID=
```
