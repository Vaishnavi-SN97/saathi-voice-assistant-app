# Progress

- [x] P0 scaffold
- [x] P1 server base (Firebase admin, auth, audit, status transitions, FileStore, media/TTS cache, MOCK_AI, POST /applications, firestore.rules, set-banker-claim)

## Needs native-speaker check (server/data/form.json)
Machine-written; all Hindi (`hi`) and Kannada (`kn`) strings need review:
- consent text (hi, kn)
- full_name, occupation, monthly_income, loan_amount, loan_purpose prompts (hi, kn)
Watch: formal vs informal "you" (आप / ನೀವು), the word for "loan" (ऋण vs लोन; ಸಾಲ), and "rupees" phrasing.

## Notes
- `server/.env` holds real keys (gitignored). The keys were pasted in plain text into an example file - rotate them if that file was ever shared.
- `.env` values need cleaning before real use: stray quotes/spaces (`MOCK_AI= true`, `SARVAM_API_KEY= "..."`), FIREBASE_PRIVATE_KEY is a JSON fragment, TWILIO_WHATSAPP_FROM must be `whatsapp:+91...`, and duplicate CORS_ORIGINS/MOCK_AI lines.
