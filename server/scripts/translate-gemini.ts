// Fills in whatever is still English in the generated language files, using Gemini.
//   npm run translate:gemini          -> only the missing strings
//   npm run translate:gemini -- --dry -> just report what is missing
//
// Why a second translator: Sarvam needs account credit per call, and a long run can exhaust it. Gemini
// translates in batches (one request for many strings), so finishing a language costs a handful of requests.
// Sarvam stays the first choice in `npm run translate`; this fills the gaps.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleGenAI } from "@google/genai";
import { LANGS, LANGUAGES, type Lang } from "../src/languages.js";
import { DEFAULT_MODELS } from "../src/services/gemini.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DRY = process.argv.includes("--dry");
const PLACES = [
  { dir: join(ROOT, "server", "data", "strings"), what: "server" },
  { dir: join(ROOT, "web", "src", "locales"), what: "screens" },
];
const BATCH = 25;

const env = new Map<string, string>();
for (const line of readFileSync(join(ROOT, "server", ".env"), "utf8").split(/\r?\n/)) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
  if (m && !env.has(m[1])) env.set(m[1], m[2].trim().replace(/^["']|["']$/g, ""));
}
const KEY = process.env.GEMINI_API_KEY ?? env.get("GEMINI_API_KEY");
if (!KEY) { console.error("No GEMINI_API_KEY in server/.env"); process.exit(1); }
const client = new GoogleGenAI({ apiKey: KEY });

const readJson = (f: string) => JSON.parse(readFileSync(f, "utf8")) as Record<string, string>;
const file = (dir: string, lang: string) => join(dir, `${lang}.json`);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let modelIndex = 0;
/** One batch of strings, as a JSON object, translated in a single request. Falls to the next model on a quota error. */
async function translateBatch(texts: Record<string, string>, lang: Lang): Promise<Record<string, string>> {
  const prompt = `Translate the VALUES of this JSON into ${LANGUAGES[lang].english} (${LANGUAGES[lang].code}), for a banking app used by elderly people in India.
Rules: keep every key exactly as it is; keep any {placeholder} in braces untouched and in the same form; keep it short, plain and respectful; do not transliterate into Latin letters, use the language's own script; reply with JSON only.
${JSON.stringify(texts, null, 1)}`;

  for (let attempt = 0; attempt < DEFAULT_MODELS.length * 2; attempt++) {
    const model = DEFAULT_MODELS[modelIndex % DEFAULT_MODELS.length];
    try {
      const r = await client.models.generateContent({
        model,
        contents: prompt,
        config: { temperature: 0, responseMimeType: "application/json" },
      });
      const out = JSON.parse(r.text ?? "{}") as Record<string, string>;
      if (Object.keys(out).length) return out;
      throw new Error("empty answer");
    } catch (e) {
      const msg = String((e as Error).message);
      if (/429|RESOURCE_EXHAUSTED|404|NOT_FOUND|503|UNAVAILABLE/.test(msg)) {
        modelIndex++;
        await sleep(600);
        continue;
      }
      throw e;
    }
  }
  throw new Error("every Gemini model refused the batch");
}

let filled = 0, failed = 0;
for (const { dir, what } of PLACES) {
  const en = readJson(file(dir, "en"));
  const keys = Object.keys(en).filter((k) => k !== "_note");

  for (const lang of LANGS) {
    if (lang === "en" || lang === "hi" || lang === "kn") continue;
    const table = readJson(file(dir, lang));
    const missing = keys.filter((k) => !table[k] || table[k] === en[k]);
    if (!missing.length) continue;
    console.log(`${LANGUAGES[lang].english} ${what}: ${missing.length} missing`);
    if (DRY) continue;

    for (let i = 0; i < missing.length; i += BATCH) {
      const slice = missing.slice(i, i + BATCH);
      const batch = Object.fromEntries(slice.map((k) => [k, en[k]]));
      try {
        const got = await translateBatch(batch, lang);
        let n = 0;
        for (const k of slice) {
          const v = got[k];
          if (typeof v === "string" && v.trim() && v !== en[k]) { table[k] = v.trim(); n++; }
        }
        filled += n;
        process.stdout.write(`  ${i + slice.length}/${missing.length} (+${n})\r`);
      } catch (e) {
        failed += slice.length;
        console.warn(`\n  batch failed: ${(e as Error).message.slice(0, 90)}`);
      }
    }
    writeFileSync(file(dir, lang), JSON.stringify(table, null, 2) + "\n");
    console.log(`  saved ${file(dir, lang).replace(ROOT, ".")}`);
  }
}

// the form file mirrors the server strings
if (!DRY) {
  const formFile = join(ROOT, "server", "data", "form.json");
  const form = JSON.parse(readFileSync(formFile, "utf8"));
  const tables = Object.fromEntries(LANGS.map((l) => [l, readJson(file(PLACES[0].dir, l))])) as Record<Lang, Record<string, string>>;
  const pick = (key: string) => Object.fromEntries(LANGS.map((l) => [l, tables[l][key] ?? tables.en[key]]));
  form.consent = pick("form.consent");
  for (const f of form.fields) {
    f.label = pick(`form.${f.id}.label`);
    f.prompt = pick(`form.${f.id}.prompt`);
    for (const o of f.options ?? []) o.label = pick(`form.${f.id}.option.${o.value}`);
  }
  writeFileSync(formFile, JSON.stringify(form, null, 2) + "\n");
  console.log(`\nfilled ${filled} strings${failed ? `, ${failed} still missing` : ""}. form.json rebuilt.`);
}
