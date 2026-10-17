import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { after, describe, it } from "node:test";
import { createApp } from "./app.js";
import { loadEnv } from "./env.js";
import { toWav16kMono } from "./services/audio-convert.js";
import { createSarvam } from "./services/sarvam.js";
import { scanText } from "./services/scam-shield.js";
import { MemoryStore } from "./store.js";

describe("scam shield", () => {
  it("blocks a spaced English OTP and redacts it", () => {
    const r = scanText("my OTP is 4 8 2 9 1 7");
    assert.equal(r.level, "block");
    assert.ok(r.reasons.includes("otp_shared"));
    assert.ok(!/4829/.test(r.text) && r.text.includes("[REDACTED]"));
  });
  it("blocks spoken-word OTP", () => assert.equal(scanText("the otp is four eight two nine one seven").level, "block"));
  it("blocks a Hindi OTP with Devanagari digits", () => assert.equal(scanText("मेरा ओटीपी ४ ८ २ ९ १ ७ है").level, "block"));
  it("blocks a Hindi PIN and a Kannada OTP", () => {
    assert.equal(scanText("मेरा पिन 1234 है").level, "block");
    assert.equal(scanText("ನನ್ನ ಒಟಿಪಿ ೪೮೨೯೧೭").level, "block");
  });
  it("blocks card and Aadhaar numbers", () => {
    assert.equal(scanText("card 4111 1111 1111 1111").level, "block");
    assert.equal(scanText("aadhaar 1234 5678 9012").level, "block");
  });
  it("lets ordinary loan answers through", () => {
    for (const t of ["I earn 15000 rupees a month", "I need one loan of fifty thousand", "मुझे 50000 रुपये चाहिए"]) {
      assert.equal(scanText(t).level, "none", t);
    }
  });
  it("only warns when OTP is mentioned without a value", () => assert.equal(scanText("what is an OTP").level, "warn"));
});

describe("voice routes (MOCK_AI)", () => {
  const env = loadEnv({ MOCK_AI: "true", JWT_SECRET: "t" } as NodeJS.ProcessEnv);
  const verifier = async () => ({ uid: "u1", role: "applicant" as const, anonymous: true });
  const server = createApp({ env, store: new MemoryStore(), verifier }).listen(0);
  const base = () => `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const auth = { authorization: "Bearer x" };
  after(() => server.close());

  it("POST /tts returns playable media", async () => {
    const r = await fetch(`${base()}/tts`, {
      method: "POST",
      headers: { ...auth, "content-type": "application/json" },
      body: JSON.stringify({ text: "नमस्ते", language: "hi", pace: 0.9 }),
    });
    assert.equal(r.status, 200);
    const { audioUrl } = await r.json();
    const a = await fetch(base() + audioUrl);
    assert.equal(a.status, 200);
    assert.match(a.headers.get("content-type") ?? "", /audio/);
    const wav = Buffer.from(await a.arrayBuffer());
    // round-trip through ffmpeg, then POST /voice/stt
    const conv = await toWav16kMono(wav);
    assert.equal(conv.subarray(0, 4).toString(), "RIFF");
    const fd = new FormData();
    fd.append("audio", new Blob([wav], { type: "audio/wav" }), "a.wav");
    fd.append("language", "hi");
    const s = await fetch(`${base()}/voice/stt`, { method: "POST", headers: auth, body: fd });
    assert.equal(s.status, 200);
    const j = await s.json();
    assert.equal(j.transcript, "mock transcript");
    assert.equal(j.flagged, false);
  });

  it("STT requires auth and audio", async () => {
    assert.equal((await fetch(`${base()}/voice/stt`, { method: "POST" })).status, 401);
    assert.equal((await fetch(`${base()}/voice/stt`, { method: "POST", headers: auth, body: new FormData() })).status, 400);
  });
});

describe("Sarvam (real, needs SARVAM_API_KEY)", { skip: !process.env.SARVAM_API_KEY }, () => {
  it("tts -> convert -> stt gives a sensible transcript", { timeout: 60000 }, async () => {
    const sarvam = createSarvam(process.env.SARVAM_API_KEY);
    const { audio } = await sarvam.tts("What is your full name?", "en");
    assert.ok(audio.length > 1000);
    const transcript = await sarvam.stt(await toWav16kMono(audio), "en");
    console.log("real transcript:", transcript);
    assert.match(transcript.toLowerCase(), /name/);
  });
});
