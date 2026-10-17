import type { Env } from "../env.js";
import type { Lang } from "../form.js";
import { createSarvam } from "../services/sarvam.js";
import { mockStt, mockTts } from "./mock.js";

export interface Ai {
  /** Voice name, part of the TTS cache key (so mock audio never pollutes real audio). */
  voice: string;
  tts(text: string, lang: Lang, pace?: number): Promise<{ audio: Buffer; mime: string }>;
  /** `wav` is 16 kHz mono WAV. Omit lang to auto-detect. */
  stt(wav: Buffer, lang?: Lang): Promise<string>;
  /** Source language is auto-detected. */
  translate(text: string, to: Lang): Promise<string>;
}

export function createAi(env: Env): Ai {
  if (env.MOCK_AI) {
    return { voice: "mock", tts: async (t, l) => ({ audio: mockTts(t, l), mime: "audio/wav" }), stt: mockStt, translate: async (t, to) => `[${to}] ${t}` };
  }
  return createSarvam(env.SARVAM_API_KEY);
}
