import type { Env } from "../env.js";
import { mockTranscribe, mockTts } from "./mock.js";

export interface Ai {
  tts(text: string, lang: string): Promise<{ audio: Buffer; mime: string }>;
  transcribe(audio: Buffer, lang: string): Promise<string>;
}

export function createAi(env: Env): Ai {
  if (env.MOCK_AI) {
    return {
      tts: async (t, l) => ({ audio: mockTts(t, l), mime: "audio/wav" }),
      transcribe: mockTranscribe,
    };
  }
  const notReady = () => { throw new Error("Real AI provider not implemented yet (set MOCK_AI=true)"); };
  return { tts: notReady, transcribe: notReady };
}
