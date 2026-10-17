import type { Language } from "../types";
import { speakText } from "../utils/speech";
import { api } from "./api";
import { playUrl } from "./audio";
import { LANG_CODE } from "./i18n";

/**
 * Speaks with the SERVER voice (Sarvam, cached mp3) and falls back to the browser voice only if that fails.
 *
 * Always prefer this over speakText(): most devices ship English voices only, so browser speech is silent in
 * Hindi and Kannada. The browser is a last resort (and the right one when the server itself is unreachable).
 */
export async function speakServer(text: string, lang: Language, pace = 1): Promise<void> {
  try {
    const r = await api<{ audioUrl: string }>("/tts", { json: { text: text.slice(0, 600), language: lang, pace } });
    await playUrl(r.audioUrl);
  } catch (e) {
    if (e instanceof DOMException && e.name === "NotAllowedError") return; // autoplay blocked: the person can tap again
    speakText(text, LANG_CODE[lang], pace < 1);
  }
}
