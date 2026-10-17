# Saathi

A voice-first assistant that helps senior citizens fill a bank savings-account form in **Hindi, Kannada or English**.
One question at a time, read back to confirm, document photos checked for mismatches, a bank officer approves, the
customer gets a WhatsApp update and a QR code, and signs at the branch. The AI proposes, rules decide, a human approves and signs.
All data in the demo is fake.

| Folder | What it is |
| --- | --- |
| `web/` | React + Vite + TypeScript + Tailwind. Customer app at `/`, bank app at `/bank` (queue, detail, check-in, numbers). |
| `server/` | Node 20 + Express + TypeScript, run with `tsx` (no build step). Sarvam (speech), Gemini (understanding), Firebase (auth + Firestore), Twilio (WhatsApp). |
| `firestore.rules` | Clients read only their own application (bankers read all); every write goes through the API. |

## Run it locally

```bash
cd server && cp .env.example .env     # fill in keys, or keep MOCK_AI=true to run with no keys at all
npm install && npm run dev            # http://localhost:8080  (GET /health)

cd web && cp .env.example .env        # VITE_API_URL + the 4 VITE_FIREBASE_* values
npm install && npm run dev            # open it at phone width; /bank is the bank app
```

`MOCK_AI=true` gives canned speech and understanding, and reads the fake demo documents from their QR codes: everything runs without keys.

## Useful commands (in `server/`)

| Command | What it does |
| --- | --- |
| `npm test` | All tests (real Sarvam / Gemini checks are opt-in: `RUN_REAL_AI=1`). |
| `npm run seed` | Writes 1 branch and 7 fake demo applications (marked `demo: true`) to Firestore; prints how to sign in to the bank app. |
| `npm run decide -- <appId> approve\|send_back "note"\|sign\|token` | Acts as the bank on one application (watch the customer app update live). |
| `npm run set-banker -- <email>` | Gives an account the `role=banker` claim. |
| `npm run journey:remote -- --url <api>` | The whole journey against a running API (`--stub` runs it in-process). |
| `npm run prod-env -- --api <url> --web <url>` | Builds production variable files to paste into Railway / Vercel (prints no values). |
| `npm run secret-scan` | Scans the repo (and `-- --history` every commit) for secrets. |
| `npm run retention` | Deletes ID photos of signed applications and applications idle for more than 7 days (the server also does this every 6 hours). |
| `npm run purge-tts -- --file strings.json` | Clears cached audio for strings you changed. |
| `npm run make-docs` | Redraws the fake demo documents in `server/assets/demo-docs`. |

## More

- [DEPLOY.md](DEPLOY.md): put it online (Railway + Vercel + Firebase), step by step.
- [DEMO.md](DEMO.md): the 3-minute demo, exact phrases, and what to do when something fails.
- [PROGRESS.md](PROGRESS.md): decisions, differences from `SPEC.md`, and the Hindi / Kannada text that still needs a native-speaker check.
- [SPEC.md](SPEC.md): the product spec.

Rules the code enforces: never ask for an OTP or PIN (scam shield on every spoken or typed answer); keep only the last 4 digits
of Aadhaar; secrets live only in `server/.env` and the browser never calls Sarvam, Gemini or Twilio.
