// One tiny real call to each outside service, using server/.env. Prints PASS/FAIL only, never a key.
//   npm run keys-check
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const envFile = join(ROOT, "server", ".env");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (m) process.env[m[1]] ??= m[2].trim().replace(/^["']|["']$/g, "");
  }
}

const { loadEnv } = await import("../server/src/env.js");
const { createSarvam } = await import("../server/src/services/sarvam.js");
const { createExtractor } = await import("../server/src/services/gemini.js");
const { toWav16kMono } = await import("../server/src/services/audio-convert.js");
const { form } = await import("../server/src/form.js");

const env = loadEnv({ ...process.env, MOCK_AI: "false" } as NodeJS.ProcessEnv);
const results: [string, boolean, string][] = [];
const row = (name: string, ok: boolean, detail: string) => results.push([name, ok, detail]);
const why = (e: unknown) => {
  const up = (e as { upstream?: { status?: number; code?: string; message?: string } }).upstream;
  if (up?.status) return `HTTP ${up.status}${up.code ? ` ${up.code}` : ""}${up.message ? `: ${up.message}` : ""}`.slice(0, 90);
  const m = (e as Error)?.message ?? String(e);
  return /429|RESOURCE_EXHAUSTED/.test(m) ? "429 quota" : /401|403|invalid.?key|unauthor/i.test(m) ? "key rejected" : /404|NOT_FOUND/.test(m) ? "404 not found" : m.slice(0, 70);
};

console.log(`MOCK_AI in server/.env = ${process.env.MOCK_AI} (this check always uses the real services)\n`);

const sarvam = createSarvam(env.SARVAM_API_KEY);
const spoken = new Map<string, Buffer>();

for (const [lang, text] of [["hi", "नमस्ते"], ["kn", "ನಮಸ್ಕಾರ"], ["en", "Hello"]] as const) {
  try {
    const { audio, mime } = await sarvam.tts(text, lang);
    spoken.set(lang, audio);
    row(`Sarvam text-to-speech ${lang}`, audio.length > 1024 && mime === "audio/mpeg", `${Math.round(audio.length / 1024)} KB ${mime}`);
  } catch (e) {
    row(`Sarvam text-to-speech ${lang}`, false, why(e));
  }
}

// speech-to-text through the real pipeline: mp3 -> 16 kHz mono WAV -> Sarvam
try {
  // Judge speech-to-text on its own: if text-to-speech is down, send a locally generated tone instead.
  const tone = Buffer.alloc(44 + 16000 * 2);
  tone.write("RIFF", 0); tone.writeUInt32LE(36 + 16000 * 2, 4); tone.write("WAVEfmt ", 8);
  tone.writeUInt32LE(16, 16); tone.writeUInt16LE(1, 20); tone.writeUInt16LE(1, 22);
  tone.writeUInt32LE(22050, 24); tone.writeUInt32LE(44100, 28); tone.writeUInt16LE(2, 32); tone.writeUInt16LE(16, 34);
  tone.write("data", 36); tone.writeUInt32LE(16000 * 2, 40);
  for (let i = 0; i < 16000; i++) tone.writeInt16LE(Math.round(6000 * Math.sin((2 * Math.PI * 220 * i) / 22050)), 44 + i * 2);

  const wav = await toWav16kMono(spoken.get("hi") ?? tone); // also proves the ffmpeg conversion works
  const header = wav.subarray(0, 4).toString() === "RIFF";
  const rate = wav.readUInt32LE(24), channels = wav.readUInt16LE(22);
  const transcript = await sarvam.stt(wav, "hi");
  row("Sarvam speech-to-text", header && rate === 16000 && channels === 1, `${rate / 1000} kHz mono WAV accepted -> "${transcript}"`);
} catch (e) {
  row("Sarvam speech-to-text", false, why(e));
}

try {
  const r = await createExtractor(env).extractAnswer(form.fields.find((f) => f.id === "occupation")!, "main kisan hoon", "hi");
  row("Gemini (JSON reply)", r.value === "farmer", `value=${JSON.stringify(r.value)} confidence=${r.confidence}`);
} catch (e) {
  row("Gemini (JSON reply)", false, why(e));
}

const pad = Math.max(...results.map((r) => r[0].length));
for (const [name, ok, detail] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${name.padEnd(pad)}  ${detail}`);
const failed = results.filter((r) => !r[1]).length;
console.log(`\n${results.length - failed}/${results.length} checks passed.`);
process.exit(failed ? 1 : 0);
