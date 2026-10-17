import axios from "axios";
import FormData from "form-data";
import type { Ai } from "../ai/index.js";
import { AppError } from "../errors.js";
import { CODES, type Lang } from "../form.js";
import type { TtsCache } from "../mediaStore.js";

const BASE = "https://api.sarvam.ai";
/** SPEC example voice; verified to work for hi-IN, kn-IN and en-IN with bulbul:v3. */
export const VOICE = "priya";

export type Sarvam = Ai & { translate(text: string, to: Lang): Promise<string> };

export function createSarvam(apiKey: string | undefined): Sarvam {
  if (!apiKey) throw new Error("SARVAM_API_KEY is not set (or use MOCK_AI=true)");
  const headers = { "api-subscription-key": apiKey };
  const fail = (e: unknown): never => {
    const status = axios.isAxiosError(e) ? e.response?.status : undefined;
    const upstream = axios.isAxiosError(e) ? (e.response?.data as any)?.error : undefined;
    console.error(axios.isAxiosError(e) ? `Sarvam ${status ?? "network"}: ${JSON.stringify(e.response?.data ?? e.message)}` : String(e));
    // keep the upstream detail on the error so scripts and logs can tell "no credits" from "bad key"
    throw Object.assign(new AppError(502, "upstream_error", "Speech service failed"), { upstream: { status, code: upstream?.code, message: upstream?.message } });
  };

  return {
    voice: VOICE,
    async stt(wav, lang) {
      try {
        const fd = new FormData();
        fd.append("file", wav, { filename: "audio.wav", contentType: "audio/wav" });
        fd.append("model", "saaras:v4");
        fd.append("mode", "transcribe");
        if (lang) fd.append("language_code", CODES[lang]);
        const r = await axios.post(`${BASE}/speech-to-text`, fd, { headers: { ...headers, ...fd.getHeaders() }, timeout: 30000 });
        return String(r.data.transcript ?? "");
      } catch (e) { return fail(e); }
    },
    async tts(text, lang, pace = 1) {
      try {
        const r = await axios.post(
          `${BASE}/text-to-speech`,
          { text, language_code: CODES[lang], model: "bulbul:v3", speaker: VOICE, pace, output_audio_codec: "mp3" },
          { headers, timeout: 30000 },
        );
        const audio = Buffer.from(r.data.audios?.[0] ?? "", "base64");
        // A 200 with no real audio would otherwise be cached as silence and look like "the voice is broken".
        if (audio.length < 1024) throw new Error(`empty audio for ${CODES[lang]} (${audio.length} bytes)`);
        return { audio, mime: "audio/mpeg" };
      } catch (e) { return fail(e); }
    },
    async translate(text, to) {
      try {
        const r = await axios.post(
          `${BASE}/translate`,
          { input: text, source_language_code: "auto", target_language_code: CODES[to] },
          { headers, timeout: 30000 },
        );
        return String(r.data.translated_text ?? "");
      } catch (e) { return fail(e); }
    },
  };
}

/** Synthesize once per (text, lang, voice, pace); returns the media id. */
export async function ttsCached(ai: Ai, cache: TtsCache, text: string, lang: Lang, pace = 1): Promise<string> {
  const code = CODES[lang];
  const hit = await cache.lookup(text, code, ai.voice, pace);
  if (hit) return hit;
  const t = await ai.tts(text, lang, pace);
  return cache.save(text, code, ai.voice, t.audio, t.mime, pace);
}
