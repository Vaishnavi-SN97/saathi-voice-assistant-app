// Deletes cached TTS audio (Firestore media/{sha1(text+lang+voice)}) for strings that changed, so it regenerates on next use.
//   npm run purge-tts -- <hi|kn|en> "old text" ["old text 2" ...]
//   npm run purge-tts -- --file old-strings.json      ({"hi": ["old text", ...], "kn": [...]}; safest for Hindi/Kannada on Windows)
// Covers both voices (real "priya", mock) and the normal + slow (0.75) pace. Reads Firestore from server/.env.
import { readFileSync } from "node:fs";
import { CODES, toLang, type Lang } from "../src/form.js";
import { loadEnv } from "../src/env.js";
import { firebaseDeps } from "../src/firebase.js";
import { MediaStore, TtsCache } from "../src/mediaStore.js";
import { VOICE } from "../src/services/sarvam.js";

const args = process.argv.slice(2);
const jobs: [Lang, string[]][] = [];
if (args[0] === "--file") {
  const data = JSON.parse(readFileSync(args[1], "utf8")) as Record<string, string[]>;
  for (const [l, texts] of Object.entries(data)) {
    const lang = toLang(l);
    if (!lang) throw new Error(`unsupported language "${l}"`);
    jobs.push([lang, texts]);
  }
} else {
  const lang = toLang(args[0]);
  if (!lang || args.length < 2) {
    console.error('Usage: npm run purge-tts -- <hi|kn|en> "old text" ["old text 2" ...]  |  --file strings.json');
    process.exit(1);
  }
  jobs.push([lang, args.slice(1)]);
}

const env = loadEnv();
const { store } = firebaseDeps(env);
const cache = new TtsCache(new MediaStore(store, env.QR_JWT_SECRET));

let deleted = 0, checked = 0;
for (const [lang, texts] of jobs) {
  for (const text of texts) {
    for (const voice of [VOICE, "mock"]) {
      for (const pace of [1, 0.75]) {
        checked++;
        const id = cache.key(text, CODES[lang], voice, pace);
        if (await store.get(`media/${id}`)) {
          await store.delete(`media/${id}`);
          deleted++;
          console.log(`deleted media/${id} (${lang}, ${voice}, pace ${pace}): ${text.slice(0, 40)}`);
        }
      }
    }
  }
}
console.log(`${deleted} cached audio file(s) deleted (${checked} cache keys checked)`);
