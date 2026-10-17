import { useEffect, useRef } from "react";
import type { Language } from "../types";
import { speakText } from "../utils/speech";
import { LANG_CODE } from "./i18n";

/**
 * Says an error message out loud once, each time it changes.
 * Uses the browser voice on purpose: when a call fails the server (and its audio) may be unreachable.
 */
export function useSpokenError(message: string | null | undefined, lang: Language) {
  const last = useRef<string | null>(null);
  useEffect(() => {
    const text = message ?? null;
    if (!text) { last.current = null; return; }
    if (text === last.current) return;
    last.current = text;
    speakText(text, LANG_CODE[lang]);
  }, [message, lang]);
}
