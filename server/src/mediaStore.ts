import { createHash, randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import type { Store } from "./store.js";

export class MediaStore {
  constructor(private store: Store, private secret: string) {}

  async put(data: Buffer, mime: string, id: string = randomUUID()) {
    await this.store.set(`media/${id}`, { data, mime, at: new Date().toISOString() });
    return id;
  }
  async get(id: string) {
    const d = await this.store.get(`media/${id}`);
    return d ? { data: Buffer.from(d.data), mime: d.mime as string } : null;
  }
  signToken(id: string, ttlSeconds = 3600) {
    return jwt.sign({ mid: id }, this.secret, { expiresIn: ttlSeconds });
  }
  verifyToken(id: string, token: string) {
    try {
      return (jwt.verify(token, this.secret) as { mid?: string }).mid === id;
    } catch {
      return false;
    }
  }
  url(id: string) {
    return `/media/${id}?token=${encodeURIComponent(this.signToken(id))}`;
  }
}

/** TTS cache hooks: deterministic media id per (lang, text). */
export class TtsCache {
  constructor(private media: MediaStore) {}
  key = (lang: string, text: string) => "tts-" + createHash("sha256").update(`${lang}\n${text}`).digest("hex").slice(0, 32);
  async lookup(lang: string, text: string) {
    const id = this.key(lang, text);
    return (await this.media.get(id)) ? id : null;
  }
  async save(lang: string, text: string, audio: Buffer, mime = "audio/wav") {
    return this.media.put(audio, mime, this.key(lang, text));
  }
}
