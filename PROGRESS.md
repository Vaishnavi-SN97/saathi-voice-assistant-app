# Progress

- [x] P0 scaffold
- [x] P1 server base (Firebase admin, auth, audit, status transitions, FileStore, media/TTS cache, MOCK_AI, POST /applications, firestore.rules, set-banker-claim)
- [x] P2 voice (Sarvam stt/tts/translate, audio-convert, scam shield, /voice/stt, /tts)
- [x] P3 interview (Gemini extractor, interview-engine, /interview/answer + /confirm, last field -> docs_pending)
- [x] Align P0-P3 with SPEC.md (below)
- [x] P4 validators (Verhoeff, PAN, IFSC, mobile, age), matcher (own Jaro-Winkler), mismatches (8 codes en/hi/kn), readiness (SPEC weights)

## Aligned with SPEC.md (changed)
- Sarvam: STT `saaras:v4` + `mode=transcribe`; TTS `bulbul:v3`, `language_code`, speaker `priya`, `output_audio_codec=mp3` (audio/mpeg); translate `source_language_code=auto`, no model. All verified live in en-IN, hi-IN, kn-IN.
- Language: `application.language` is stored as `hi-IN|kn-IN|en-IN`; the API accepts `hi` or `hi-IN`.
- Scam shield: any of OTP, PIN, CVV, password, passcode, MPIN, UPI PIN, "card number" (+ ओटीपी/पिन/पासवर्ड, ಒಟಿಪಿ/ಪಿನ್/ಪಾಸ್‌ವರ್ಡ್) blocks, alone or with 4-6 digits; 13-19 digit runs block. Blocked: nothing stored, `metrics.scamBlocks++`, audit without content, warning text + audio. Removed my extra "warn" level and the 12-digit Aadhaar block.
- Storage: `applications/{id}/files/{aadhaar|pan|passbook|signature|pdf}`, images max 1280 px, JPEG q70, < 900 KB. Media id = `sha1(text+lang+voice)` (pace appended only when not 1), 10-minute token on GET /media/:id. Owner field is `customerUid` (was ownerUid); role name `customer` (was applicant).
- Audit moved to `applications/{id}/audit {at, actor, action, detail}` (was a top-level collection).
- Statuses now exactly the SPEC flow (draft, docs_pending, needs_fix, ready_for_review, approved, sent_back, signed).
- Form: the SPEC savings-account form (full_name, dob, mobile, address, occupation, nominee_name, nominee_relation, notify_consent) replaced my placeholder loan questions. Answers are `{value, valueEn, confidence, confirmed}`; Gemini returns value + English transliteration + confidence; confidence < 0.6 or invalid -> max 2 retries, then typing offer. Consent is `{at, version}`; `metrics.startedAt` is set at creation; `notify.{phone,consent}` is filled from mobile + notify_consent.
- Env names now match SPEC (PORT 8080, PUBLIC_API_URL, FIREBASE_CLIENT_EMAIL/PRIVATE_KEY, QR_JWT_SECRET, ...). Replaced JWT_SECRET and FIREBASE_SERVICE_ACCOUNT_JSON. `server/.env` was cleaned in place (quotes, duplicates, private-key fragment); old copy at `server/.env.bak` (gitignored, delete when happy). Firebase credentials verified to reach Firestore.
- Gemini: on 429 retry once, then GEMINI_API_KEY_BACKUP; other errors fail fast (SPEC).

## Kept (differs from SPEC, works)
- Extra optional env `JSON_LIMIT`: the body-size limit needs a knob.
- Default Gemini model `gemini-3.8-flash` when GEMINI_MODEL is empty: `gemini-2.5-flash` returned 404 for this key.
- Media tokens are signed with QR_JWT_SECRET plus a `typ:"media"` claim: SPEC lists no second secret.
- Mock TTS returns a silent WAV under voice name `mock`: keeps mock audio out of the real cache.
- Extra `interview.attempts` counter on the application doc: retries must survive between requests.
- "pin code" / "pincode" / पिन कोड / ಪಿನ್ ಕೋಡ್ are not treated as a PIN: the address answer would otherwise be blocked.
- Yes/no word lists are supersets of SPEC's (extra colloquial words).
- `form.json` uses `fields` (not `questions`) and carries `label` + `options` per field.
- Non-image uploads >= 900 KB are rejected (e.g. an oversized pdf).

- [x] P5 documents (extractDoc, POST /documents/extract, POST /applications/:id/check, fake demo docs in server/assets/demo-docs)

- [x] P6 pdf, submit, review, QR, check-in, sign, WhatsApp notify (server/scripts/run-journey.ts, `npm run journey`)

- [x] P7 web: Firebase anonymous auth, API client, i18n en/hi/kn, fonts, safe areas, router, language + consent + interview screens (screens 4-8 are still the static prototypes: P8/P9)

- [x] P8 web: document camera, problems, readiness screens (+ server /resolve-name)

- [x] P9 web: live status screen (Firestore onSnapshot), real QR screen, done screen, `npm run decide` to act as the bank

- [x] P10 banker app under /bank: login, live queue, application detail, approve / send back

- [x] P11 bank check-in (QR scan + paste, signature) and number tiles; server GET /metrics

- [x] P12 seed, deploy files, docs, retention (v1.0). NOT deployed: no Railway / Vercel / Firebase CLI is installed or logged in here, so DEPLOY.md has the exact dashboard steps.

## P12 decisions
- `npm run seed` (server/scripts/seed.ts): branch `udupi-main` + 7 fake applications `demo-*` (`demo: true`) in kn / hi / en: Savitri Rao ready_for_review shown as 96% (quick approve), Prakash Shenoy ready_for_review 93% (computed), Mohammed Rafi needs_fix 71%, Lakshmi Naik approved (valid QR), Arun Kumar sent_back (Hindi note), Geeta Hegde signed, Sunita Patil docs_pending. Idempotent (deletes and rewrites its own rows). It ran against your Firestore. Photos and PDFs are drawn per person (scripts/lib/fake-docs.ts); metrics timestamps are relative to the run time.
- The 96% and 71% are the requested showcase numbers: the real formula cannot give them for those cases (an eligible application scores 100 or 93), so those two rows store the shown score with `readiness.demoScore: true`; their checks and items come from the real rules.
- Demo rows are never messaged on WhatsApp (their phone numbers are made up) and never touched by the retention cleanup; the Numbers page tags them "demo data".
- Retention (server/src/services/retention.ts, tested): after SIGNING the Aadhaar / PAN / passbook photos are deleted and the signed PDF + signature are kept as the record; never-sent or sent-back applications idle more than 7 days (RETENTION_DAYS) are deleted with their files and audit. Runs 30 s after start and every 6 hours; `npm run retention` by hand; RETENTION=off disables it.
- Applications now carry `branchId` (default `udupi-main`); the web still shows the branch from a constant (same values). Firestore rules let signed-in users read `branches`.
- `GET /health` now returns `{ok, mockAi}` so a journey test can say whether real AI was used. The server refuses to start on a non-local PUBLIC_API_URL with the default QR_JWT_SECRET.
- `npm run prod-env -- --api <url> --web <url>` writes git-ignored `server/.env.production` and `web/.env.production` (MOCK_AI=false, URLs, generated QR secret) to paste into Railway / Vercel without printing values. tsx and typescript moved to server dependencies (the host runs from source). `web/vercel.json` (SPA rewrite) and `server/railway.json` added; `web/vite.config.ts` no longer needs the `.figma` folder to build (verified both ways).
- `npm run journey:remote -- --url <api>` (real Firebase sign-in; prints SKIP without a web API key + banker login) and `--stub` (in-process; passes, 12 steps). Not run against a deployment because there is none.
- `npm run secret-scan [-- --history]`: working tree clean (144 files, 7 local secret values checked). HISTORY FINDING: commit 596809c (P1) contains `web/.env.example` with your Firebase WEB API key (an identifier, public by design, but it is in the GitHub history). Fix options: restrict the key to your domains in Google Cloud console (enough in practice), or rewrite history and force-push (destructive: only if you ask).
- Local checks done: `npm test` 100 passing, web build OK, real server boots with MOCK_AI=false and `GET /health` answers, `/metrics` without a token 401.

## P11 decisions
- `/bank/checkin`: html5-qrcode camera scanner (falls back to a paste box when the camera is blocked/missing; a camera needs https or localhost) -> POST /checkin/verify -> customer summary + inline PDF -> signature_pad -> "Complete" calls POST /applications/:id/sign (QR consumed, PDF re-issued with the signature). Clear messages for used / expired / invalid QR and wrong status; verifying does not consume the QR, signing does.
- `/bank/metrics`: number tiles only, refreshed every 30 s. GET /metrics is banker-only (`server/src/services/metrics.ts`, pure and tested): applications today (IST), first-visit approval rate (of applications that reached a decision, the share approved without ever being sent back; needs the new `metrics.sentBackCount`, counted from now on), average minutes from started to sent-to-bank vs `BASELINE_MANUAL_MINUTES` (default 30), mistakes caught, scam blocks.
- "Demo data": rows with `demo: true` (P12's seed must set it) are counted by default and every tile is tagged "demo data" while any are included; a link switches to real data only (`?demo=exclude`).
- Store gained `list(collection)` (direct documents only). `npm run decide -- <appId> token` prints an approved application's QR token for the paste test.

## P10 decisions
- `/bank` (queue), `/bank/login`, `/bank/app/:id` live in `web/src/bank/`; `main.tsx` picks the banker app for any /bank path, the customer app otherwise. English only (bank staff), same colour tokens.
- Separate Firebase app instance (`saathi-bank`) so a banker session never mixes with a customer's anonymous one in the same browser. Sign-in = Firebase email/password, then the `role=banker` custom claim is required (otherwise signed out with a clear message). Give an account the claim with `npm run set-banker -- <email>` in server/ (the person must sign in again). Email/Password sign-in must be enabled in the Firebase console.
- Queue: Firestore onSnapshot on `applications`, tabs To review / In progress / Decided / All (drafts only under All), sorted by readiness (highest first, then longest waiting), status chips, blocking/warning counts, and the green "Quick approve" badge when `readiness.quickApprove` (score 90+ AND all 3 documents present and clear, see P4).
- Detail: photos via GET /files/:id/:kind fetched with the banker ID token and shown as blob URLs (revoked on leave); extracted fields with confidence, anything under 80% (or not read) in amber; Aadhaar shown masked (only the last 4 are stored anyway); mismatches + readiness checklist; PDF viewer (blob in an iframe, or new tab); audit list (live); Approve (optional note) and Send back (English reason, required; translated + voice note for the customer). Status changes arrive through the live listener, no refresh.
- firestore.rules: bankers may now read `applications/{id}/audit` (customers still cannot). REDEPLOY the rules for the audit list and the queue to work: `npx firebase-tools deploy --only firestore:rules`.
- api(): new `tokenProvider` and `blob` options (used by the banker app).

## P9 decisions
- Status screen reads ONLY the live application document (Firestore onSnapshot via `useApplication`); the timeline, headline card and buttons follow `status` + `metrics`. sent_back shows the bank's translated note and a "Fix and send again" button; approved leads to the QR screen; signed leads to the new /done screen.
- Firestore rules (`firestore.rules`: owner or banker may read an application, nobody writes from the client) must be DEPLOYED for the live listener to work: `npx firebase-tools login` then `npx firebase-tools deploy --only firestore:rules` from the repo root (no Firebase CLI is installed here) (`firebase.json` + `.firebaserc` for project saathi-f5b30 added). Until then the screen shows "Live updates are blocked by the database rules". I did not deploy anything.
- Notify-consent toggle: new `POST /applications/:id/notify-consent {consent}` (owner only, audited); WhatsApp messages stop/resume accordingly. It replaced the design's "family share" toggle (not in SPEC).
- QR screen draws the real QR in the browser (`qrcode`) from `application.qr.token` when status is approved; "Save QR to my phone" downloads the PNG. Before approval it says the QR is not ready; after signing it says the QR was used.
- Branch card: still the placeholder from the design (Manipal Co-operative Bank, Udupi Main Branch, 0820-2520111) in `web/src/lib/application.ts` (BRANCH). P12 seeds the real branch. Application number shown is `SAA-` + first 6 characters of the id.
- Server: banker actions refactored into `approveApplication / sendBackApplication / signApplication` (used by /review and /sign) and `createCtx`; `npm run decide -- <appId> approve|send_back "note"|sign|show` (server/scripts/decide.ts) acts as the bank on the real Firestore.
- Static previews of screens 3 and 7 are kept (Screen3VoiceStatic / Screen7StatusStatic) for the Hindi comparison frame.
- Every screen has the "Help / talk to a person" link.

## P8 decisions
- Camera: rear camera with guide frame, on-phone blur check (Laplacian variance on a 640 px canvas), preview with Use / Retake, upload to /documents/extract, then /check and the problems screen. "Choose a photo" works with or without a camera (gallery/file picker). Camera denied / unsupported / offline all have messages; every call has loading + retry.
- Blur is never a hard block: a blurry-looking photo shows the warning with "Retake" and "Use this photo anyway" (it is still uploaded and extracted; readiness reflects it, and the server's PHOTO_BLURRY still blocks the final send until it is retaken, per SPEC). A server-side issue after upload shows the same choice: Retake or Keep and continue.
- Calibration: ONE constant, `BLUR_THRESHOLD` in `web/src/lib/blur.ts` (12). Open the camera screen with `?debug=1` to see each photo's measured value (and the server's value + threshold after upload). The server has its own constant in `server/src/services/image-quality.ts` (also 12): if you change one, change the other. Fake demo cards measure ~1500, a heavy blur ~3; real phone photos are unmeasured so far.
- Problems screen: one card per server mismatch with a speaker button (server voice, browser fallback) and a direct action: name spelled two ways -> pick the spelling (POST /applications/:id/resolve-name {use: "answers"|doc}); every other problem -> Retake / Take that document (camera in single-document mode).
- Server: /documents/extract also returns `blurScore` + `blurThreshold`; mismatches for names/DOB carry `detail` (both values); /resolve-name sets the form name, records `nameResolved` (silences only the warning-level NAME_SPELLED_DIFFERENTLY; a hard NAME_MISMATCH stays) and re-runs the check.
- Readiness: score ring + checklist + to-dos straight from /check; "Send to bank officer" calls /submit; a 409 not_eligible shows "Fix problems" -> problems screen.

## P7 decisions
- web/.env must hold VITE_API_URL and the 4 VITE_FIREBASE_* values (Firebase console > Project settings > Your apps > Web app). Without them every API call shows a "not set up" message instead of failing silently.
- The web package.json had picked up all the server dependencies (a stray install during P0) and web/tsconfig.json had been overwritten with the server one: both restored (original Figma tsconfig; web deps are now only react, react-dom, react-router-dom, firebase and @fontsource/*).
- Phones (<= 520 px) get the app full screen with safe-area padding; wider screens keep the original iPhone-frame design preview, header tabs and screen jump bar. Screens are real routes: / /consent /interview /camera /problems /readiness /status /qr. Opening /interview without a session bounces to / (an application is needed first).
- Language: the card picker (and a small EN / हिन्दी / ಕನ್ನಡ switcher on the first two screens) changes the whole UI. The interview language is fixed when the application is created at consent; the switcher is hidden afterwards.
- Interview: mic tap to start/stop (12 s limit, live level meter) -> /voice/stt -> /interview/answer -> read-back card (server audio plays) -> /interview/confirm. Also: type instead (auto-offered after 2 failed tries), tap-an-option chips for choice fields, Listen again, Speak slower (asks /tts at pace 0.75), amber scam-warning banner with the spoken warning, a retry button on every failed call, mic-denied / unsupported messages.
- Server: /interview/answer now also returns `display` (the value as shown on the read-back card).
- Removed the dev-only "Test OTP Warning" toggle. The old static voice screen is kept as Screen3VoiceStatic.tsx for the Hindi comparison frame.
- Fonts are self-hosted (@fontsource Noto Sans / Devanagari / Kannada + Plus Jakarta Sans); the Google Fonts @import is gone.
- Not run in a real browser by me (no screenshots/browsing per the rules): hand test below.

## P6 decisions
- QR: JWT {aid, jti, typ:"qr"} HS256 with QR_JWT_SECRET, 3 days; the QR image encodes the token. `application.qr` = {jti, expiresAt, usedAt} plus `token` (extra) so the customer app can draw the QR. The PNG is also in the media store as `qr-<jti>` and goes to WhatsApp as mediaUrl. /checkin/verify does not consume the QR; /sign does (usedAt). A used QR is rejected by both with 409 qr_used.
- /submit re-evaluates (blocking mismatch or unconfirmed answer -> 409 not_eligible with the list), builds the PDF itself, sets metrics.readyAt. /pdf can also be called alone; after signing the PDF is re-issued with the signature embedded.
- /review, /checkin/verify and /sign are banker-only (403 otherwise). send_back requires a note; note -> Sarvam translate (skipped for English) -> mp3 via ttsCached -> WhatsApp text + audio.
- sent_back -> needs_fix happens on the customer's next /check; uploads are allowed while sent_back.
- Notifier never throws; audit records notify.sent / skipped(reason) / failed without phone number or text. NOTIFY_MODE=off, no consent, bad phone or missing Twilio credentials all skip. TWILIO_WHATSAPP_FROM may be given with or without the whatsapp: prefix.
- Real Twilio was NOT called (tests use a fake sender): WhatsApp mediaUrl must be publicly reachable, so it only works once PUBLIC_API_URL is a public URL; the Twilio sandbox also needs the recipient to have joined it.

## P5 decisions
- Check: any blocking mismatch moves docs_pending -> needs_fix; otherwise the status stays and `readiness.eligible=true` (POST /submit in P6 does the move to ready_for_review). mistakesCaught counts each (code, document) once, the first time it is caught.
- Documents are uploaded only while status is docs_pending or needs_fix. PAN number and IFSC are kept in `fields`; the Aadhaar number is reduced to aadhaarLast4 + valid. Account numbers are never read.
- A blurry photo reports only PHOTO_BLURRY (no *_INVALID on top). Blur = Laplacian variance < 12 (fake cards ~1500, blurred ~3) OR Gemini blurry flag.
- MOCK_AI reads the FAKE demo cards by decoding their QR code (jsqr); real Gemini reads the printed text. `npm run make-docs` regenerates; `npm run docs` runs the scenarios; `npm run docs -- --real` reads the clean set with real Gemini (3 calls).
- Gemini retry now also covers transient 500/503 ("high demand"), not just 429. The free tier allows ~20 requests/day: the real Gemini tests are opt-in via RUN_REAL_AI=1.

## P4 decisions
- Readiness: a spelled_differently name earns half the 15 name points (SPEC gives no partial rule). The quick-approve badge needs score >= 90 AND all 3 documents present and clear (a missing passbook alone scores exactly 90).
- Matcher: an initial that only one name has ("Ramesh K Shetty" vs "Ramesh Shetty") caps the result at spelled_differently, otherwise Jaro-Winkler alone would say match (0.956). Initials that the other name spells out ("R Shetty") are expanded and match.
- Mismatches blame the document, judged against the customer answers; document-vs-document pairs are used only when the customer has not given that name/DOB.
- Document fields read: aadhaar/pan fields.{name,dob}, passbook fields.{name|holderName}; valid=false maps to AADHAAR_INVALID / PAN_INVALID / IFSC_INVALID.

## Needs native-speaker check (all hi / kn text is machine-written)
- `server/data/form.json`: consent text; every field label, prompt and option label (occupation: सेवानिवृत्त/गृहिणी/किसान/व्यापार/नौकरीपेशा/अन्य; ನಿವೃತ್ತ/ಗೃಹಿಣಿ/ರೈತ/ವ್ಯಾಪಾರ/ಉದ್ಯೋಗಿ/ಇತರೆ; relation: पति/पत्नी, बेटा, बेटी; ಪತಿ/ಪತ್ನಿ, ಮಗ, ಮಗಳು).
- `server/src/services/interview-engine.ts`: read-back sentences, "didn't catch that", "say yes or no", "let's type it", Yes/No words.
- `server/src/services/scam-shield.ts`: scam warning (hi, kn). SPEC's English wording is exact; the translations are mine.
- `server/src/services/mismatches.ts` (all 8 messages + document names आधार/पैन कार्ड/पासबुक, ಆಧಾರ್/ಪ್ಯಾನ್ ಕಾರ್ಡ್/ಪಾಸ್‌ಬುಕ್) and `readiness.ts` (to-dos), hi + kn.
- `web/src/lib/i18n.tsx` P9 additions: timeline steps, status headlines, WhatsApp toggle, QR screen, done screen, live-update errors (hi, kn).
- `web/src/lib/i18n.tsx`: all UI strings (hi, kn): language / consent / interview / help texts, error messages, and the P8 camera / problems / readiness texts (problem titles, spelling choices, checklist labels, "Use this photo anyway").
- `server/src/services/notify.ts`: all 5 WhatsApp messages (hi, kn).
- `server/src/services/gemini.ts`: none (prompts are English). Demo docs are English only.
- `server/src/services/yesno.ts`: hi/kn yes/no word lists (colloquial variants may be missing).
- Watch: formal vs informal "you" (आप / ನೀವು), "whatsapp" spelling (व्हाट्सऐप / ವಾಟ್ಸಾಪ್), how dates and digits are read aloud.

## Notes
- `server/.env` holds real keys (gitignored). They were once pasted in plain text into an example file: rotate if that file was ever shared.
- `TWILIO_WHATSAPP_FROM` is empty: the old value was not a number. SPEC wants just the sender number, e.g. `+14155238886` (sandbox), since the code adds the `whatsapp:` prefix.
- `MOCK_AI=true` is set in the local `.env` (SPEC default is false).

## Translation fixes + interview 401 report
- Corrected by a native speaker (no longer in the "needs check" list): `mismatch.NAME_SPELLED_DIFFERENTLY` (server/src/services/mismatches.ts, hi + kn; it no longer names the document, so no {doc} in that message) and `scam.warning` (server/src/services/scam-shield.ts SHIELD_WARNING; hi was already identical, kn changed). The web has no copy of either (it shows what the server sends; the problem card TITLE `p_NAME_SPELLED_DIFFERENTLY` in web/src/lib/i18n.tsx is a different string and was not part of the fix).
- Cached audio: media ids are sha1(text+lang+voice), so a changed string already gets a new id; the old files are orphans. `npm run purge-tts -- --file strings.json` (or `-- <hi|kn> "old text"`) deletes them (both voices, normal + slow pace). Ran it against Firestore for all old variants (per document name, with and without the card title prefix): 0 were cached, nothing to delete.
- Bug "401 Unauthorized + Something went wrong" on the mic: reproduced the real pipeline in-process with the real keys: speech-to-text works (Hindi name recognised); the step after it, Gemini extraction, failed with 429 (the free tier's 20 requests/day is used up), which the UI showed as the generic error. I could not reproduce a 401 from our server on this path: possible sources are (a) an expired 10-minute audio link (GET /media 401: harmless, now self-heals through /tts) or (b) a rejected ID token. Fixes: Gemini outage/quota now gives a friendly "assistant is busy: type your answer in English" prompt (typed English still works through simple rules; spoken or Hindi/Kannada typed text cannot be trusted without the AI); the API client retries once with a force-refreshed token on 401; the server now logs why a token was rejected (`auth: POST /voice/stt rejected (...)`). If a 401 still shows up, the server console line will say which request and why.
- Native check: new "assistant is busy" message (hi, kn) in interview-engine.ts; "session expired" (hi, kn) in web/src/lib/i18n.tsx.
