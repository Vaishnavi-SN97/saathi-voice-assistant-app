// Calls Sarvam's text-to-speech DIRECTLY (no app code in the way) for hi-IN, kn-IN and en-IN.
// Prints HTTP status, Sarvam's own error message, and the audio size; saves each mp3 so you can play it.
//   npm run tts-test                 -> uses the model/speaker the server uses
//   npm run tts-test -- --speaker X  -> try another voice
// Nothing secret is printed.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, existsSync } from "node:fs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "server", "assets", "tts-check");

const env = new Map<string, string>();
const envFile = join(ROOT, "server", ".env");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (m && !env.has(m[1])) env.set(m[1], m[2].trim().replace(/^["']|["']$/g, ""));
  }
}
const key = process.env.SARVAM_API_KEY ?? env.get("SARVAM_API_KEY");
if (!key) { console.error("No SARVAM_API_KEY in server/.env"); process.exit(1); }

const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : undefined; };
const MODEL = arg("model") ?? "bulbul:v3";
const SPEAKER = arg("speaker") ?? "priya";

const CASES = [
  { code: "hi-IN", text: "नमस्ते! साथी में आपका स्वागत है।" },
  { code: "kn-IN", text: "ನಮಸ್ಕಾರ! ಸಾಥಿಗೆ ಸುಸ್ವಾಗತ." },
  { code: "en-IN", text: "Hello! Welcome to Saathi." },
];

const isMp3 = (b: Buffer) => b.subarray(0, 3).toString() === "ID3" || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0);
const isWav = (b: Buffer) => b.subarray(0, 4).toString() === "RIFF";

mkdirSync(OUT, { recursive: true });
console.log(`Sarvam text-to-speech: model ${MODEL}, speaker ${SPEAKER}\n`);

let failures = 0;
for (const { code, text } of CASES) {
  let status = 0, detail = "", size = 0, file = "";
  try {
    const r = await fetch("https://api.sarvam.ai/text-to-speech", {
      method: "POST",
      headers: { "api-subscription-key": key, "content-type": "application/json" },
      body: JSON.stringify({ text, target_language_code: code, speaker: SPEAKER, model: MODEL, pace: 1, output_audio_codec: "mp3" }),
    });
    status = r.status;
    const body = (await r.json()) as { audios?: string[]; error?: { message?: string } };
    if (!r.ok) detail = body?.error?.message ?? JSON.stringify(body).slice(0, 160);
    else if (!body.audios?.[0]) detail = "200 but no audio in the answer";
    else {
      const bytes = Buffer.from(body.audios[0], "base64");
      size = bytes.length;
      const kind = isMp3(bytes) ? "mp3" : isWav(bytes) ? "wav" : "unknown format";
      if (size < 2000) detail = `only ${size} bytes: that is silence, not speech`;
      else detail = kind;
      file = join(OUT, `${code}.${isWav(bytes) ? "wav" : "mp3"}`);
      writeFileSync(file, bytes);
    }
  } catch (e) {
    detail = (e as Error).message.slice(0, 160);
  }
  const ok = status === 200 && size >= 2000;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${code}  HTTP ${status || "-"}  ${size ? `${Math.round(size / 1024)} KB` : "no audio"}  ${detail}`);
  if (file) console.log(`      saved ${file.replace(ROOT, ".")}`);
}

console.log(`\n${CASES.length - failures}/${CASES.length} languages returned audio.`);
if (failures) {
  console.log("If a language failed, try another voice:  npm run tts-test -- --speaker anushka");
  process.exit(1);
}
