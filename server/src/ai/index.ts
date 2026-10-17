import type { Env } from "../env.js";
import type { Lang } from "../form.js";
import { createSarvam } from "../services/sarvam.js";
import { mockStt, mockTts } from "./mock.js";

export interface Ai {
  tts(text: string, lang: Lang, pace?: number): Promise<{ audio: Buffer; mime: string }>;
  /** `wav` is 16 kHz mono WAV. Omit lang to auto-detect. */
  stt(wav: Buffer, lang?: Lang): Promise<string>;
}

export function createAi(env: Env): Ai {
  if (env.MOCK_AI) {
    return { tts: async (t, l) => ({ audio: mockTts(t, l), mime: "audio/wav" }), stt: mockStt };
  }
  return createSarvam(env.SARVAM_API_KEY);
}
