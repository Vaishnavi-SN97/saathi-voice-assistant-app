# Deploying Saathi

There are two ways. **If two separate services have given you trouble, use Option A.**

---

# Option A: one service (simplest)

The server serves the built web app itself: **one URL, no CORS, and no build-time API URL that can
fall out of step with the backend.** The web app calls the API on its own origin.

On Render, **New → Web Service** → this repo, then set:

| Setting | Value |
| --- | --- |
| Root Directory | *(leave empty — the repository root)* |
| Build Command | `npm install && npm run deploy:build` |
| Start Command | `npm run deploy:start` |
| Health Check Path | `/health` |

Environment variables: the server ones from the table in Option B below, **plus `SERVE_WEB=true`**, plus
the five `VITE_*` values (they are needed at build time, when the web app is compiled).

- Leave `VITE_API_URL` **unset**. Empty means "same origin", which is exactly right here.
- Set `CORS_ORIGINS` to your one URL, and `PUBLIC_API_URL` to the same URL.
- Add that URL's domain to Firebase → Authentication → Settings → Authorised domains.

Then check, in this order:

1. `<url>/health` → `{"ok":true,"mockAi":false}`
2. `<url>/api` → `{"ok":true,"service":"saathi-api","health":"/health","web":true}` — `web:true` confirms the app is being served.
3. `<url>/` → the Saathi app. `<url>/bank` → the banker screen (it is a client-side route, and the server hands it the app shell).

If `/api` reports `web:false`, the web build was not found: the build command did not run
`npm run deploy:build`, or `SERVE_WEB` is not `true`. The server says so in its log and keeps the API running.

To run this locally: `npm run deploy:build` then `cd server && SERVE_WEB=true npm start`, and open <http://localhost:8080>.

## The same thing on another platform

Option A is plain Node with no platform-specific code, so it runs anywhere that can run
`npm install` and a long-lived process. The two commands and the variables above are all that change.

- **Railway** — `server/railway.json` is already here. New Project → Deploy from GitHub → set the same
  build and start commands, add the variables, then Settings → Networking → **Generate Domain**.
- **Fly.io** — `fly launch --no-deploy`, set the same commands, `fly secrets set NAME=value` for each
  variable, then `fly deploy`.

Anywhere you go, the server must be reached on `process.env.PORT`; it already binds `0.0.0.0`.
It needs a real Node process, not a serverless function: it converts audio with ffmpeg and
keeps a retention timer.

---

# Option B: two services

**Server (Express) → Render. Web (Vite) → Vercel. Data, sign-in and rules stay in Firebase (`saathi-f5b30`).**

Do it in this order: **Render first**, then Vercel, then come back to Render for two values, then Firebase.
You never type a secret into a terminal: `npm run prod-env -- --api <render url> --web <vercel url>` writes two
git-ignored files whose contents you paste into the dashboards, and it prints no values.

---

## 1. Render: the API (about 5 minutes)

1. Push this repo to GitHub (already done).
2. <https://dashboard.render.com> → **New → Web Service** → **Build and deploy from a Git repository** → pick this repo.
3. Render reads `render.yaml`, so these are already set: **Root Directory `server`**, **Build `npm install`**,
   **Start `npm start`**, **Health check `/health`**, **Free** plan, Node 20. Leave them.
4. Click **Advanced → Add Environment Variable** (or **Environment** after the first deploy) and add the names below.
   `MOCK_AI`, `NOTIFY_MODE`, `BASELINE_MANUAL_MINUTES`, `RETENTION_DAYS` and `NODE_VERSION` come from `render.yaml`; you fill the rest.
   Do **not** set `PORT` — Render sets it and the server reads `process.env.PORT`.

   | Name | What goes in it |
   | --- | --- |
   | `SARVAM_API_KEY` | from your Sarvam dashboard |
   | `GEMINI_API_KEY` | from Google AI Studio |
   | `GEMINI_API_KEY_BACKUP` | optional second key, ideally in a **different** Google Cloud project |
   | `GEMINI_MODEL` | leave empty unless you want to pin one |
   | `FIREBASE_PROJECT_ID` | `saathi-f5b30` |
   | `FIREBASE_CLIENT_EMAIL` | from the service-account JSON |
   | `FIREBASE_PRIVATE_KEY` | from the service-account JSON, in double quotes, with literal `\n` between lines |
   | `QR_JWT_SECRET` | a long random string (the server refuses to start in public without one) |
   | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` | from Twilio |
   | `DEMO_WHATSAPP_TO` | optional: your own number, to receive the demo rows' updates |
   | `CORS_ORIGINS` | **leave empty for now** — step 3 |
   | `PUBLIC_API_URL` | **leave empty for now** — step 3 |

5. **Create Web Service**. When it goes live, copy the URL, e.g. `https://saathi-api.onrender.com`.
6. Check it: open `<render url>/health` → `{"ok":true,"mockAi":false}`.

## 2. Vercel: the web app (about 3 minutes)

1. <https://vercel.com/new> → import the same repo.
2. **Root Directory: `web`**. Framework **Vite** is detected; `web/vercel.json` already sends every route to
   `index.html`, which is what makes `/bank` work on a refresh.
3. **Environment Variables** (Production) — all five, names exactly:

   | Name | Value |
   | --- | --- |
   | `VITE_API_URL` | your Render URL from step 1.5, no trailing slash |
   | `VITE_FIREBASE_API_KEY` | Firebase console → Project settings → Your apps → Web app |
   | `VITE_FIREBASE_AUTH_DOMAIN` | `saathi-f5b30.firebaseapp.com` |
   | `VITE_FIREBASE_PROJECT_ID` | `saathi-f5b30` |
   | `VITE_FIREBASE_APP_ID` | from the same panel |

4. **Deploy**, then copy the URL, e.g. `https://saathi.vercel.app`.

## 3. Back to Render: join the two together

Render → your service → **Environment** → set these two, then **Save** (it redeploys):

- `CORS_ORIGINS` = your Vercel URL exactly, e.g. `https://saathi.vercel.app` (no trailing slash; comma-separated for several)
- `PUBLIC_API_URL` = your Render URL, e.g. `https://saathi-api.onrender.com`

`PUBLIC_API_URL` must be public because Twilio downloads the WhatsApp voice note and QR image from it. Until it is,
messages still go out, but as text only.

## 4. Firebase: let the new domain sign people in

1. Console → **Authentication → Settings → Authorized domains → Add domain** → your Vercel domain
   (`saathi.vercel.app`, plus any preview or custom domain). Keep `localhost`.
2. Console → **Authentication → Sign-in method**: **Anonymous** and **Email/Password** both enabled.
3. Publish the rules once (the live status screen and the bank queue need them):
   `npx firebase-tools login` then `npx firebase-tools deploy --only firestore:rules --project saathi-f5b30`.
4. Give yourself the bank role: in `server/`, `npm run set-banker -- <your email>`, then sign out and in again.

## 5. Live test (6 steps)

1. `<render url>/health` → `{"ok":true,"mockAi":false}`.
2. Open `<vercel url>` on a phone, pick **ಕನ್ನಡ**, tap a speaker button: you hear Kannada (tap once if a "Tap to hear this" bar appears).
3. Finish the interview, upload the three sample documents from `server/assets/demo-docs/clean/`.
4. Send it to the bank, then open `<vercel url>/bank` on a laptop and sign in: the application is at the top of **To review**.
5. **Approve** it: the customer screen flips to approved by itself and the QR appears; a WhatsApp arrives if consent was given.
6. **Check-in** tab → scan that QR → sign → **Complete**: status becomes signed and the PDF carries the signature.

## 6. Put it on the phone's home screen

The app is a phone web app: open the Vercel URL in **Chrome (Android)** or **Safari (iOS)** and use **Add to Home
Screen**. It then launches full screen with the Saathi icon and no browser bars, and the microphone, camera and
QR all work because Vercel serves it over https.

Do NOT test from a LAN address like `http://192.168.1.5:8443`: browsers only allow the microphone and camera on
https or localhost, so those features will be dead on the phone. Deploy first, then open the https URL there.

Expo Go is not a route for this app — it runs React Native and cannot load a Vite build. The home-screen install
above gives the same app-like result with no extra code.

## 7. Cold starts (free plan)

Render's free plan sleeps after about 15 minutes idle and takes 30–60 seconds to wake, so the first call after a
pause looks broken. **Before a demo, open `<render url>/health` once** and wait for `{"ok":true}`; everything after
that is fast. To keep it awake during an event, hit `/health` every 10 minutes (a free uptime pinger will do).

## If something is wrong

| Symptom | Cause |
| --- | --- |
| The API host returns `Not Found` and the headers show `x-render-routing: no-server` | Nothing of ours is running: the platform has no live instance, so the request never reaches Express. Read the service's **Logs** — the server names any variable it is missing. It no longer exits over one. |
| Changed `VITE_API_URL` but nothing happened | It is baked in at **build** time. Rebuild the site (Render: Manual Deploy → Clear build cache & deploy). Option A avoids this entirely. |
| "Cannot reach Saathi" on screen | The API URL is wrong or the service is down. |
| "Could not sign in to Saathi" on screen | Firebase, not the network: add the site's domain under Authentication → Settings → Authorised domains. The browser console names the exact code. |
| Web says "not set up yet" | `VITE_FIREBASE_*` missing on Vercel — add them and redeploy. |
| Browser console: CORS error | `CORS_ORIGINS` is not exactly the Vercel origin. |
| "Live updates are blocked by the database rules" | Step 4.3 not done. |
| `/bank` says no banker access | `npm run set-banker -- <email>`, then sign out and in. |
| Voice silent, text fine | Sarvam credits (HTTP 402) or quota — check with `npm run keys-check`. |
| Documents fail with 502 | Gemini daily cap; the server already falls back across models, so add `GEMINI_API_KEY_BACKUP` in another project. |
| Everything fails at once | Set `MOCK_AI=true` on Render for a keyless demo (canned voice, sample documents only). |

## Data retention

The server cleans up 30 seconds after start and every 6 hours (`npm run retention` runs it by hand): ID photos are
deleted once an application is **signed** (the signed PDF and signature stay), and applications never sent or left
idle for more than `RETENTION_DAYS` (7) are deleted entirely. Seeded demo rows are never touched.
