import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { after, describe, it } from "node:test";
import { createApp } from "./app.js";
import { loadEnv } from "./env.js";
import { toWav16kMono } from "./services/audio-convert.js";
import { createSarvam, VOICE } from "./services/sarvam.js";
import { scanText } from "./services/scam-shield.js";
import { MemoryStore } from "./store.js";

describe("scam shield (SPEC: block keywords, alone or with 4-6 digits, and card numbers)", () => {
  it("blocks a spaced English OTP and redacts the digits", () => {
    const r = scanText("my OTP is 4 8 2 9 1 7");
    assert.equal(r.level, "block");
    assert.ok(r.reasons.includes("otp_with_digits"));
    assert.ok(!/4829/.test(r.text) && r.text.includes("[REDACTED]"));
  });
  it("blocks spoken-word OTP", () => assert.equal(scanText("the otp is four eight two nine one seven").level, "block"));
  it("blocks Hindi: Devanagari digits, pin, password", () => {
    assert.equal(scanText("मेरा ओटीपी ४ ८ २ ९ १ ७ है").level, "block");
    assert.equal(scanText("मेरा पिन 1234 है").level, "block");
    assert.equal(scanText("मेरा पासवर्ड बताता हूँ").level, "block");
  });
  it("blocks Kannada OTP / PIN / password", () => {
    assert.equal(scanText("ನನ್ನ ಒಟಿಪಿ ೪೮೨೯೧೭").level, "block");
    assert.equal(scanText("ಪಿನ್ 1234").level, "block");
    assert.equal(scanText("ನನ್ನ ಪಾಸ್‌ವರ್ಡ್ ಹೇಳುತ್ತೇನೆ").level, "block");
  });
  it("blocks every listed secret word even without digits", () => {
    for (const t of ["what is my otp", "my upi pin", "the CVV", "my mpin", "passcode", "password is secret", "my card number"]) {
      assert.equal(scanText(t).level, "block", t);
    }
  });
  it("blocks a 16-digit card number", () => assert.equal(scanText("4111 1111 1111 1111").level, "block"));
  it("lets ordinary answers through, including addresses with a pin code and a 12-digit number", () => {
    for (const t of ["Ramesh Shetty", "15 March 1950", "9876543210", "12 MG Road, pin code 560001", "pincode 560001", "पिन कोड 560001", "1234 5678 9012", "मैं सेवानिवृत्त हूँ"]) {
      assert.equal(scanText(t).level, "none", t);
    }
  });
});

describe("voice routes (MOCK_AI)", () => {
  const env = loadEnv({ MOCK_AI: "true", QR_JWT_SECRET: "t" } as NodeJS.ProcessEnv);
  const verifier = async () => ({ uid: "u1", role: "customer" as const, anonymous: true });
  const server = createApp({ env, store: new MemoryStore(), verifier }).listen(0);
  const base = () => `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const auth = { authorization: "Bearer x" };
  after(() => server.close());

  it("POST /tts returns playable media; /voice/stt accepts audio", async () => {
    const r = await fetch(`${base()}/tts`, {
      method: "POST",
      headers: { ...auth, "content-type": "application/json" },
      body: JSON.stringify({ text: "नमस्ते", language: "hi-IN", pace: 0.9 }),
    });
    assert.equal(r.status, 200);
    const { audioUrl } = await r.json();
    const a = await fetch(base() + audioUrl);
    assert.equal(a.status, 200);
    assert.match(a.headers.get("content-type") ?? "", /audio/);
    const wav = Buffer.from(await a.arrayBuffer());
    assert.equal((await toWav16kMono(wav)).subarray(0, 4).toString(), "RIFF");

    const fd = new FormData();
    fd.append("audio", new Blob([wav], { type: "audio/wav" }), "a.wav");
    fd.append("language", "hi");
    const s = await fetch(`${base()}/voice/stt`, { method: "POST", headers: auth, body: fd });
    assert.equal(s.status, 200);
    const j = await s.json();
    assert.equal(j.transcript, "mock transcript");
    assert.equal(j.blocked, false);
  });

  it("STT requires auth and audio", async () => {
    assert.equal((await fetch(`${base()}/voice/stt`, { method: "POST" })).status, 401);
    assert.equal((await fetch(`${base()}/voice/stt`, { method: "POST", headers: auth, body: new FormData() })).status, 400);
  });
});

describe("Sarvam (real, needs SARVAM_API_KEY)", { skip: !process.env.SARVAM_API_KEY }, () => {
  const sarvam = createSarvam(process.env.SARVAM_API_KEY);
  const cases = [
    ["en", "What is your full name?", /name/i],
    ["hi", "आपका पूरा नाम क्या है?", /नाम/],
    ["kn", "ನಿಮ್ಮ ಪೂರ್ಣ ಹೆಸರು ಏನು?", /ಹೆಸರು/],
  ] as const;
  for (const [lang, text, re] of cases) {
    it(`${VOICE} mp3 tts -> wav -> saaras:v4 stt (${lang})`, { timeout: 60000 }, async () => {
      const { audio, mime } = await sarvam.tts(text, lang);
      assert.equal(mime, "audio/mpeg");
      const transcript = await sarvam.stt(await toWav16kMono(audio), lang);
      console.log(`real ${lang} transcript:`, transcript);
      assert.match(transcript, re);
    });
  }
  it("translate with source auto", { timeout: 60000 }, async () => {
    assert.match(await sarvam.translate("How much do you earn?", "hi"), /कमा/);
  });
});
