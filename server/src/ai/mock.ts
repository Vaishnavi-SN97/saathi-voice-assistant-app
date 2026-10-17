import type { Field, Lang } from "../form.js";
import type { DocKind } from "../services/doc-types.js";
import { mockExtractDoc } from "../services/doc-mock.js";
import { classifyYesNo } from "../services/yesno.js";

/** Canned stand-ins used when MOCK_AI=true. */
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

export const mockStt = async (_wav: Buffer, _lang?: Lang) => "mock transcript";

export interface Extracted { value: string | number | boolean | null; valueEn: string | null; confidence: number }

const toAscii = (s: string) => s.replace(/[०-९]/g, (c) => String(c.charCodeAt(0) - 0x0966));

/** Deterministic extractor for MOCK_AI: simple parsing of typed-style answers, confidence 0.9 on success. */
export const mockExtractor = {
  extractDoc: (kind: DocKind, image: Buffer, _mime: string) => mockExtractDoc(kind, image),
  async extractAnswer(f: Field, text: string, _lang: Lang): Promise<Extracted> {
    const t = text.trim();
    const none: Extracted = { value: null, valueEn: null, confidence: 0 };
    const ok = (value: string | boolean, valueEn: string | null = typeof value === "string" ? value : null): Extracted => ({ value, valueEn, confidence: 0.9 });
    switch (f.type) {
      case "date": {
        const m = toAscii(t).match(/(\d{1,4})[\/\-. ](\d{1,2})[\/\-. ](\d{1,4})/);
        if (!m) return none;
        const [a, b, c] = m.slice(1).map(Number);
        const [y, mo, d] = a > 31 ? [a, b, c] : [c, b, a];
        return ok(`${String(y).padStart(4, "0")}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
      }
      case "mobile": {
        const d = toAscii(t).replace(/\D/g, "");
        return d ? ok(d) : none;
      }
      case "choice": {
        const lower = t.toLowerCase();
        const o = f.options?.find((o) => o.value === lower || Object.values(o.label).some((l) => l.toLowerCase() === lower || lower.includes(l.toLowerCase())));
        return o ? ok(o.value) : none;
      }
      case "yesno": {
        const v = classifyYesNo(t);
        return v === "unclear" ? none : ok(v === "yes");
      }
      default:
        return t ? ok(t) : none;
    }
  },
};
