import type { Language } from "../types";
import { speakText } from "../utils/speech";
import { api } from "./api";
import { playUrl } from "./audio";
import { LANG_CODE } from "./i18n";

/** Speaks text with the server voice (cached mp3); falls back to the browser voice if that fails. */
export async function speakServer(text: string, lang: Language): Promise<void> {
  try {
    const r = await api<{ audioUrl: string }>("/tts", { json: { text: text.slice(0, 600), language: lang } });
    await playUrl(r.audioUrl);
  } catch (e) {
    if (e instanceof DOMException && e.name === "NotAllowedError") return;
    speakText(text, LANG_CODE[lang]);
  }
}
