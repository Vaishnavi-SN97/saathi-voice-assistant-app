import sharp from "sharp";
import { AppError } from "./errors.js";
import type { Store } from "./store.js";

export const MAX_BYTES = 900 * 1024;

/** Compress an image to a JPEG under MAX_BYTES by lowering quality, then size. */
export async function compressImage(input: Buffer): Promise<Buffer> {
  let width = 2000;
  for (let round = 0; round < 6; round++) {
    for (const quality of [80, 65, 50, 40]) {
      const out = await sharp(input).rotate().resize({ width, withoutEnlargement: true }).jpeg({ quality, mozjpeg: true }).toBuffer();
      if (out.length < MAX_BYTES) return out;
    }
    width = Math.round(width * 0.7);
  }
  throw new AppError(422, "file_too_large", "Image cannot be compressed enough");
}

export class FileStore {
  constructor(private store: Store) {}
  private path = (appId: string, kind: string) => `applications/${appId}/files/${kind}`;

  async put(appId: string, kind: string, data: Buffer, mime: string) {
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
