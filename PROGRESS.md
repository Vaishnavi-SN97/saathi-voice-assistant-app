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
- `server/src/services/notify.ts`: all 5 WhatsApp messages (hi, kn).
- `server/src/services/gemini.ts`: none (prompts are English). Demo docs are English only.
- `server/src/services/yesno.ts`: hi/kn yes/no word lists (colloquial variants may be missing).
- Watch: formal vs informal "you" (आप / ನೀವು), "whatsapp" spelling (व्हाट्सऐप / ವಾಟ್ಸಾಪ್), how dates and digits are read aloud.

## Notes
- `server/.env` holds real keys (gitignored). They were once pasted in plain text into an example file: rotate if that file was ever shared.
- `TWILIO_WHATSAPP_FROM` is empty: the old value was not a number. SPEC wants just the sender number, e.g. `+14155238886` (sandbox), since the code adds the `whatsapp:` prefix.
- `MOCK_AI=true` is set in the local `.env` (SPEC default is false).
