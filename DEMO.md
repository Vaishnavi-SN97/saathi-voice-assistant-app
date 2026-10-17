# Saathi: 3-minute demo

Story: Ramesh Shetty, 75, opens a savings account without help. He speaks, Saathi checks his papers, the bank officer approves in one minute, and he signs at the counter. All data is fake.

## Before you start (5 minutes, once)

- Server and web are running (or deployed). `GET /health` answers ok. Decide the mode: **real** (`MOCK_AI=false`: Sarvam speech + Gemini) or **safe** (`MOCK_AI=true`: no keys needed, canned speech; use "Type instead").
- `cd server && npm run seed` (fills the bank screens with 7 demo applications: two ready for review (96% and 93%), one needing fixes at 71%, one approved, one sent back, one signed).
- **Laptop** (bank officer): open `/bank`, sign in with your banker account, leave the Queue open. Have the **Check-in** tab ready in a second tab.
- **Phone** (customer): open the app at phone width, allow microphone and camera. Put the fake documents where the file picker finds them: copy `server/assets/demo-docs/name-variant/` (aadhaar.jpg, pan.jpg, passbook.jpg) to the phone's gallery, or open the app on the laptop at a narrow window and use its files.
- Check the volume. Close other tabs that use the microphone.

## The click path

| Time | Who | Do | You should see |
| --- | --- | --- | --- |
| 0:00 | Phone | Tap **हिन्दी**, then **Continue**. Tap **मैं सहमत हूँ, शुरू करें** ("I agree"). | The app switches to Hindi, a voice reads the first question. |
| 0:20 | Phone | Tap the mic and say: **"मेरा नाम रमेश शेट्टी है।"** Tap the mic again to stop. | A card "क्या मैंने सही सुना?" with the name. Tap **हाँ, सही है**. |
| 0:40 | Phone | Mic, say: **"मेरी जन्म तिथि पंद्रह मार्च उन्नीस सौ पचास है।"** Confirm. | The date as 15-03-1950. |
| 1:00 | Phone | Mic, say the scam line: **"मेरा ओटीपी चार आठ दो नौ एक सात है।"** | An amber warning (the voice says never to share OTP or PIN). Nothing is saved. This is the "scam shield". |
| 1:10 | Phone | Tap **लिखकर दर्ज करें** (type instead) and type **9876543210**, send, confirm. Then type **12 MG Road, Bengaluru**; tap the option **सेवानिवृत्त**; type **Sita Shetty**; tap **पति/पत्नी**; answer the WhatsApp question with the mic (**"हाँ"**) or type **yes**. Confirm each one. | After the last answer the camera screen opens. |
| 1:50 | Phone | **Choose a photo**: `aadhaar.jpg`, then `pan.jpg`, then `passbook.jpg` (the **name-variant** set). | After the third, the "quick check" screen. |
| 2:10 | Phone | One card: "आपके नाम की वर्तनी दो तरह से लिखी है" (Ramesh Shetty vs RAMESH K SHETTY). Tap the speaker, then **"Ramesh Shetty" (what you told me)**. Continue, then **बैंक अधिकारी को भेजें**. | Readiness ring near 100%, then the status screen: "बैंक अधिकारी के पास". |
| 2:25 | Laptop | In the bank Queue the new application is at the top of **To review** (live). Open it: photos, amber fields, checks, PDF. Click **Approve**, then **Confirm approve**. | Chip turns **Approved**. |
| 2:35 | Phone | The status screen flips to **स्वीकृत** by itself. Tap **फास्ट काउंटर क्यूआर कोड देखें**. | A real QR code. |
| 2:45 | Laptop | **Check-in** tab: point the webcam at the phone's QR (or paste the code). Review the summary, let the "customer" sign in the box, click **Complete**. | "Signed ✓". On the phone the status screen now says signed; tap **पूरा करें** for the Done screen. |
| 2:55 | Laptop | Open **Numbers**. | Tiles for applications today, first-visit approval, minutes vs 30 on paper, mistakes caught, scam attempts blocked (tagged "demo data" while seeded rows count; use "Show real data only"). |

Short on time? The demo rows give you the bank side without a customer: approve `Savitri Rao` (96%, "Quick approve"), check in `Lakshmi Naik` (approved; get her QR code with `npm run decide -- demo-lakshmi token` and paste it), and open `Arun Kumar` (sent back with a Hindi note).

## Which fake document for what

| File (in `server/assets/demo-docs/`) | Shows |
| --- | --- |
| `clean/` (aadhaar, pan, passbook) | Everything matches: readiness 100, no problems. |
| `name-variant/` | PAN says "RAMESH K SHETTY": the name-spelling card (use this for the demo). |
| `blurry-aadhaar.jpg` | The blur warning with **Retake** and **Use this photo anyway**; if kept, the bank sees a blocking "photo is blurry". |
| `invalid-aadhaar.jpg` | "Aadhaar number could not be checked" (the checksum fails). |

The interview answers for the demo person: name Ramesh Shetty, born 15/03/1950.

## When something fails

| What breaks | What you see | Do this |
| --- | --- | --- |
| **Wi-Fi / no internet** | "You are offline" banner, calls fail with a retry link. | Switch the phone to your hotspot. No internet at all: run server and web on the laptop (`npm run dev` in both, `VITE_API_URL=http://localhost:8080`) and use the laptop's browser; the bank side then needs the same network. |
| **Sarvam (speech) down or slow** | Mic answers fail with "Something went wrong", or no voice. | Tap **Type instead** (always on screen): typing still works. Questions are read by the browser voice if the server audio fails. |
| **Gemini down or out of free quota** (about 20 requests a day) | Spoken answers say "the assistant is busy, type in English". Document upload fails. | Type English answers (they still work through simple rules). For documents, switch to **MOCK_AI=true** (below): it reads the fake cards. Keep `GEMINI_API_KEY_BACKUP` filled to double the quota. |
| **WhatsApp (Twilio) fails** | Nothing arrives on the phone. | It is a courtesy only: the status screen and the bank screens update live. Say so and carry on. (The audit trail shows `notify.skipped` or `notify.failed` with the reason.) |
| **Server down** | Everything shows "Cannot reach Saathi". | Railway > Deployments > redeploy / restart. Fallback: run the server on the laptop (see Wi-Fi row). Demo data stays in Firestore. |
| **Camera blocked** | "The camera is blocked". | Use **Choose a photo** instead (always available). |
| **Live status not updating** | Status screen says live updates are blocked. | Firestore rules not published: `npx firebase-tools deploy --only firestore:rules`. |
| **Anything else** | | **Emergency switch: `MOCK_AI=true`** (Railway Variables, or `MOCK_AI=true` in `server/.env` and restart locally). The whole journey then runs without Sarvam or Gemini: the mic returns a canned line, so answer by typing or tapping the option buttons; audio is silent; documents are read from the fake demo cards' QR codes (use the files above). Switch it back to `false` afterwards. |

Reset between runs: `npm run seed` (resets the demo rows; real test applications you made stay, and the retention clean-up removes abandoned ones after 7 days).
