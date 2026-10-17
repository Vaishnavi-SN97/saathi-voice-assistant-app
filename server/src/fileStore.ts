import sharp from "sharp";
import { AppError } from "./errors.js";
import type { Store } from "./store.js";

export const MAX_BYTES = 900 * 1024;
export const FILE_KINDS = ["aadhaar", "pan", "passbook", "signature", "pdf"] as const;
export type FileKind = (typeof FILE_KINDS)[number];
export const isFileKind = (k: string): k is FileKind => (FILE_KINDS as readonly string[]).includes(k);

/** SPEC: max 1280 px, JPEG q70, under 900 KB. Goes lower in quality/size only if still too big. */
export async function compressImage(input: Buffer): Promise<Buffer> {
  let side = 1280;
  for (let round = 0; round < 5; round++) {
    for (const quality of [70, 55, 40]) {
      const out = await sharp(input)
        .rotate()
        .resize({ width: side, height: side, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality, mozjpeg: true })
        .toBuffer();
      if (out.length < MAX_BYTES) return out;
    }
    side = Math.round(side * 0.75);
  }
  throw new AppError(422, "file_too_large", "Image cannot be compressed enough");
}

export class FileStore {
  constructor(private store: Store) {}
  private path = (appId: string, kind: string) => `applications/${appId}/files/${kind}`;

  async put(appId: string, kind: FileKind, data: Buffer, mime: string) {
    let bytes = data, outMime = mime;
    if (mime.startsWith("image/")) {
      bytes = await compressImage(data);
      outMime = "image/jpeg";
    } else if (data.length >= MAX_BYTES) {
      throw new AppError(413, "file_too_large", "File exceeds 900 KB");
    }
    await this.store.set(this.path(appId, kind), { data: bytes, mime: outMime, size: bytes.length, at: new Date().toISOString() });
    return { size: bytes.length, mime: outMime };
  }

  async get(appId: string, kind: string): Promise<{ data: Buffer; mime: string } | null> {
    const d = await this.store.get(this.path(appId, kind));
    return d ? { data: Buffer.from(d.data), mime: d.mime } : null;
  }
}
