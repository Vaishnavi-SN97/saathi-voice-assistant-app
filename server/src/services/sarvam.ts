import axios from "axios";
import FormData from "form-data";
import type { Ai } from "../ai/index.js";
import { AppError } from "../errors.js";
import type { Lang } from "../form.js";
import type { TtsCache } from "../mediaStore.js";

const BASE = "https://api.sarvam.ai";
/** "ritu" is a female Bulbul v3 voice that supports hi-IN, kn-IN and en-IN. */
export const VOICE = "ritu";
export const CODES: Record<Lang, string> = { en: "en-IN", hi: "hi-IN", kn: "kn-IN" };

export function createSarvam(apiKey: string | undefined): Ai & { translate(text: string, from: Lang, to: Lang): Promise<string> } {
  if (!apiKey) throw new Error("SARVAM_API_KEY is not set (or use MOCK_AI=true)");
  const headers = { "api-subscription-key": apiKey };
  const fail = (e: unknown): never => {
    console.error(axios.isAxiosError(e) ? `Sarvam ${e.response?.status ?? "network"}: ${JSON.stringify(e.response?.data ?? e.message)}` : String(e));
    throw new AppError(502, "upstream_error", "Speech service failed");
  };

  return {
    async stt(wav, lang) {
      try {
        const fd = new FormData();
        fd.append("file", wav, { filename: "audio.wav", contentType: "audio/wav" });
        fd.append("model", "saarika:v2.5");
        fd.append("language_code", lang ? CODES[lang] : "unknown");
        const r = await axios.post(`${BASE}/speech-to-text`, fd, { headers: { ...headers, ...fd.getHeaders() }, timeout: 30000 });
        return String(r.data.transcript ?? "");
      } catch (e) { return fail(e); }
    },
    async tts(text, lang, pace = 1) {
      try {
        const r = await axios.post(
          `${BASE}/text-to-speech`,
          { text, target_language_code: CODES[lang], speaker: VOICE, model: "bulbul:v3", pace, speech_sample_rate: 16000 },
          { headers, timeout: 30000 },
        );
        return { audio: Buffer.from(r.data.audios[0], "base64"), mime: "audio/wav" };
      } catch (e) { return fail(e); }
    },
    async translate(text, from, to) {
      try {
        const r = await axios.post(
          `${BASE}/translate`,
          { input: text, source_language_code: CODES[from], target_language_code: CODES[to], model: "mayura:v1", mode: "formal" },
          { headers, timeout: 30000 },
        );
        return String(r.data.translated_text ?? "");
      } catch (e) { return fail(e); }
    },
  };
}

/** Synthesize once per (lang, pace, text); returns the media id. */
export async function ttsCached(ai: Ai, cache: TtsCache, text: string, lang: Lang, pace = 1): Promise<string> {
  const key = pace === 1 ? lang : `${lang}@${pace}`;
  const hit = await cache.lookup(key, text);
  if (hit) return hit;
  const t = await ai.tts(text, lang, pace);
  return cache.save(key, text, t.audio, t.mime);
}
