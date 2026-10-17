import { createHash, randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import type { Store } from "./store.js";

export const MEDIA_TOKEN_TTL_SECONDS = 600; // SPEC: 10-minute token

/** media/{id}: audio bytes + mime. Served by GET /media/:id?token= (token-only, so Twilio can fetch). */
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
  signToken(id: string, ttlSeconds = MEDIA_TOKEN_TTL_SECONDS) {
    return jwt.sign({ mid: id, typ: "media" }, this.secret, { algorithm: "HS256", expiresIn: ttlSeconds });
  }
  verifyToken(id: string, token: string) {
    try {
      const p = jwt.verify(token, this.secret, { algorithms: ["HS256"] }) as { mid?: string; typ?: string };
      return p.typ === "media" && p.mid === id;
    } catch {
      return false;
    }
  }
  url(id: string) {
    return `/media/${id}?token=${encodeURIComponent(this.signToken(id))}`;
  }
}

/** TTS cache: media id = sha1(text + lang + voice) (+ pace when not 1), per SPEC. */
export class TtsCache {
  constructor(private media: MediaStore) {}
  key = (text: string, lang: string, voice: string, pace = 1) =>
    createHash("sha1").update(text + lang + voice + (pace === 1 ? "" : `@${pace}`)).digest("hex");
  async lookup(text: string, lang: string, voice: string, pace = 1) {
    const id = this.key(text, lang, voice, pace);
    return (await this.media.get(id)) ? id : null;
  }
  save(text: string, lang: string, voice: string, audio: Buffer, mime: string, pace = 1) {
    return this.media.put(audio, mime, this.key(text, lang, voice, pace));
  }
}
