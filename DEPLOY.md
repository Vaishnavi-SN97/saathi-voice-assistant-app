# Deploying Saathi

Server (Express) -> **Railway**. Web (Vite) -> **Vercel**. Data, sign-in and rules stay in **Firebase** (project `saathi-f5b30`).

> On the machine this was built on, no deployment CLI (`railway`, `vercel`, `firebase`) was installed or logged in, so nothing has been deployed yet.
> Everything below is done in the hosts' dashboards (the most reliable way), with the CLI alternative where it exists.
> Secrets are never typed into a terminal or committed: `npm run prod-env` builds the files you paste into the dashboards and prints no values.

Do the steps **in this order**: Firebase, server, web, then wire the two URLs together.

## 1. Firebase (once)

1. Console > **Authentication > Sign-in method**: enable **Anonymous** (customers) and **Email/Password** (bankers).
2. Create the banker account: **Authentication > Users > Add user** (email + password).
3. Give it the banker role (from `server/`, with your `server/.env` in place): `npm run set-banker -- banker@example.com`. The person signs out and in again afterwards.
4. Publish the Firestore rules (the web app's live status and the bank queue need them):
   ```bash
   npx firebase-tools login
   npx firebase-tools deploy --only firestore:rules --project saathi-f5b30
   ```
   (`firebase.json` and `.firebaserc` are in the repo root.) Re-run this whenever `firestore.rules` changes.
5. Your **web app config** (Project settings > General > Your apps > Web app): `apiKey`, `authDomain`, `projectId`, `appId`. They go into `web/.env` as `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`.
   These are identifiers, not secrets, but restrict the API key to your web domains (Google Cloud console > APIs & Services > Credentials > the browser key > Website restrictions).

## 2. Server on Railway

1. railway.com > **New Project > Deploy from GitHub repo** > choose this repo.
2. Service **Settings > Source > Root Directory = `server`**. (`server/railway.json` already sets the start command `npm start` and the health check `/health`.)
3. **Settings > Networking > Generate Domain**. Note the URL, for example `https://saathi-api.up.railway.app`.
4. Variables: first build the file (needs the two URLs, so use the Railway one now and a placeholder for the web one; you fix it in step 4 below):
   ```bash
   cd server
   npm run prod-env -- --api https://saathi-api.up.railway.app --web https://saathi.vercel.app
   ```
   Open `server/.env.production`, copy everything, and in Railway **Variables > RAW Editor** paste it and save. Railway redeploys.
   The file is your `server/.env` with `MOCK_AI=false`, `PUBLIC_API_URL`, `CORS_ORIGINS`, and a generated `QR_JWT_SECRET` if you had none. Railway sets `PORT` itself.
   CLI alternative (if you installed it): `railway link`, then `railway variables --set "NAME=value"` per variable.
5. Check it: `curl https://saathi-api.up.railway.app/health` should answer `{"ok":true,"mockAi":false}`.

Server variables (names only; see `server/.env.example`):
`CORS_ORIGINS`, `PUBLIC_API_URL`, `SARVAM_API_KEY`, `GEMINI_API_KEY`, `GEMINI_API_KEY_BACKUP`, `GEMINI_MODEL`, `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`, `NOTIFY_MODE`, `MOCK_AI`, `QR_JWT_SECRET`, `BASELINE_MANUAL_MINUTES`, optional `RETENTION_DAYS` (default 7) and `RETENTION` (`off` disables the clean-up).
`FIREBASE_PRIVATE_KEY` is pasted exactly as in your `.env`: in double quotes, with literal `\n` between lines.
The server refuses to start on a public `PUBLIC_API_URL` without a real `QR_JWT_SECRET`.

## 3. Web on Vercel

1. vercel.com > **Add New > Project** > import this repo.
2. **Root Directory = `web`**. Framework: Vite (detected). `web/vercel.json` adds the rewrite that makes `/bank` and the other paths work on refresh.
3. **Environment Variables**: `npm run prod-env` also wrote `web/.env.production` (only `VITE_API_URL` is in it if you have no `web/.env` yet). Make sure all five exist for Production, then paste into the first field:
   `VITE_API_URL` (the Railway URL), `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`.
4. **Deploy**. Note the URL, for example `https://saathi.vercel.app`.

## 4. Wire them together

- On Railway set `CORS_ORIGINS` to the exact Vercel origin (`https://saathi.vercel.app`, no trailing slash; several origins can be comma-separated) and `PUBLIC_API_URL` to the Railway URL. If you used a placeholder in step 2, re-run `npm run prod-env` with the real values and paste again.
- **Firebase authorised domains**: Console > Authentication > Settings > **Authorized domains** > *Add domain*: add the Vercel domain (`saathi.vercel.app`, plus every preview or custom domain you use). Keep `localhost`. Do **not** add the Railway domain (users never sign in there).
- WhatsApp: `PUBLIC_API_URL` must be the public https Railway URL, because Twilio downloads the voice note and QR image from `PUBLIC_API_URL/media/...`. In the Twilio sandbox every recipient first sends the join word to the sandbox number; `TWILIO_WHATSAPP_FROM` is the sandbox / sender number (with or without `whatsapp:`).

## 5. Check the deployment

```bash
cd server
curl https://saathi-api.up.railway.app/health                         # {"ok":true,"mockAi":false}
npm run seed                                                           # 1 branch + 7 fake demo applications
BANKER_EMAIL=banker@example.com BANKER_PASSWORD=... FIREBASE_WEB_API_KEY=... \
  npm run journey:remote -- --url https://saathi-api.up.railway.app    # the whole journey, real AI when the server has MOCK_AI=false
npm run secret-scan                                                    # nothing may be reported in the files
```

`journey:remote` prints `SKIP` (not a failure) when it has no Firebase web API key or banker login. With `--stub` it runs the same steps in-process.
It leaves one signed test application behind (its ID photos are removed by the retention clean-up).

## Data retention

The server runs the clean-up 30 seconds after start and then every 6 hours; `npm run retention` runs it by hand.

- After an application is **signed**, its Aadhaar / PAN / passbook photos are deleted. The signed PDF and the signature stay as the record.
- Applications that were **never sent** (or were sent back and then left alone) and have been idle for more than **7 days** are deleted completely (files and audit trail).
- Applications waiting for the bank or approved are never deleted automatically. Seeded demo rows (`demo: true`) are never touched.

## Emergency switches and rollbacks

| Need | Do |
| --- | --- |
| Run without Sarvam / Gemini (outage, quota, no signal) | Railway Variables: `MOCK_AI=true` (redeploys in about a minute). The mic then returns a canned line, so answer with "Type instead" or the option buttons. Documents are read from the fake demo cards only. Set it back to `false` afterwards. |
| Stop WhatsApp | `NOTIFY_MODE=off` |
| Stop the automatic clean-up | `RETENTION=off` |
| Reset the demo rows | `npm run seed` |
| Roll back a bad deploy | Railway / Vercel dashboard > Deployments > redeploy the previous one. |

## If something is wrong

| Symptom | Likely cause |
| --- | --- |
| Web says "not set up yet" | `VITE_FIREBASE_*` missing on Vercel (rebuild after adding them). |
| Browser console: CORS error | `CORS_ORIGINS` on Railway is not exactly the Vercel origin. |
| "Live updates are blocked by the database rules" | Step 1.4 not done. |
| `/bank` sign-in says no banker access | Run `npm run set-banker -- <email>`, then sign out and in. |
| Server log line `auth: ... rejected (...)` | The reason a token was refused (wrong Firebase project, clock, expired). |
| Spoken answers say "assistant is busy" | Gemini free quota (about 20 requests a day) or outage: type in English, or switch to `MOCK_AI=true`. |
| WhatsApp never arrives | Not in the Twilio sandbox, no consent on the application, demo row (never messaged), or `PUBLIC_API_URL` is not public. Look for `notify.skipped` / `notify.failed` in the application's audit trail. |
