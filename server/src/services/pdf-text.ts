import { decodePDFRawStream, PDFArray, PDFDocument, PDFRawStream, PDFRef } from "pdf-lib";

/**
 * Text drawn on one page with pdf-lib's standard fonts (hex-encoded `<..> Tj` runs). Meant for tests and
 * spot checks of PDFs we generate ourselves; not a general PDF text extractor.
 */
export async function pdfPageText(bytes: Uint8Array, pageIndex = 0): Promise<string[]> {
  const doc = await PDFDocument.load(bytes);
  const contents = doc.getPage(pageIndex).node.Contents();
  const refs = contents instanceof PDFArray ? contents.asArray() : contents ? [contents] : [];
  const runs: string[] = [];
  for (const r of refs) {
    const stream = r instanceof PDFRef ? doc.context.lookup(r) : r;
    if (!(stream instanceof PDFRawStream)) continue;
    const text = Buffer.from(decodePDFRawStream(stream).decode()).toString("latin1");
    for (const m of text.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)) runs.push(Buffer.from(m[1], "hex").toString("latin1"));
  }
  return runs;
}

export const pdfPageCount = async (bytes: Uint8Array) => (await PDFDocument.load(bytes)).getPageCount();
