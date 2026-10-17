/** Tiny deterministic stand-ins used when MOCK_AI=true. */
export function mockTts(_text: string, _lang: string): Buffer {
  // 0.1 s of 8 kHz 16-bit mono silence as WAV.
  const samples = 800, dataLen = samples * 2;
  const b = Buffer.alloc(44 + dataLen);
  b.write("RIFF", 0); b.writeUInt32LE(36 + dataLen, 4); b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(8000, 24); b.writeUInt32LE(16000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write("data", 36); b.writeUInt32LE(dataLen, 40);
  return b;
}

export const mockTranscribe = async (_audio: Buffer, _lang: string) => "mock transcript";
