import jsQR from "jsqr";
import sharp from "sharp";
import { emptyExtraction, type DocExtraction, type DocKind } from "./doc-types.js";

/**
 * MOCK_AI document reader: the FAKE demo documents carry a QR code with their fields
 * ({t:kind, n:name, d:dob, x:number, i:ifsc}); the mock reads that instead of calling Gemini.
 * Unreadable / blurry / wrong-kind images return nothing, like a real "never guess" reader.
 */
export async function mockExtractDoc(kind: DocKind, image: Buffer): Promise<DocExtraction> {
  const { data, info } = await sharp(image).rotate().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const qr = jsQR(new Uint8ClampedArray(data), info.width, info.height);
  if (!qr) return emptyExtraction();
  let p: { t?: string; n?: string; d?: string; x?: string; i?: string };
  try { p = JSON.parse(qr.data); } catch { return emptyExtraction(); }
  if (p.t !== kind) return emptyExtraction();
  const c = 0.95;
  return {
    name: p.n ?? null,
    dob: p.d ?? null,
    number: p.x ?? null,
    ifsc: p.i ?? null,
    confidence: { name: p.n ? c : 0, dob: p.d ? c : 0, number: p.x ? c : 0, ifsc: p.i ? c : 0 },
    blurry: false,
  };
}
