import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Ai } from "./ai/index.js";
import { CODES, type Lang } from "./form.js";
import { MediaStore, TtsCache } from "./mediaStore.js";
import { ttsCached } from "./services/sarvam.js";
import { MemoryStore } from "./store.js";

/** Records what the speech service was asked for, and answers with audio that names the language. */
function fakeAi() {
  const asked: { text: string; lang: Lang; pace?: number }[] = [];
  const ai: Ai = {
    voice: "priya",
    async tts(text, lang, pace) {
      asked.push({ text, lang, pace });
      return { audio: Buffer.from(`spoken-in-${CODES[lang]}`), mime: "audio/mpeg" };
    },
    stt: async () => "",
    translate: async (t) => t,
  };
  return { ai, asked };
}

describe("every language gets its own audio", () => {
  it("asks the speech service once per language and caches them separately", async () => {
    const store = new MemoryStore();
    const media = new MediaStore(store, "secret");
    const cache = new TtsCache(media);
    const { ai, asked } = fakeAi();

    // The SAME sentence in three languages must not collapse into one cached file.
    const text = "What is your full name?";
    const ids = { en: "", hi: "", kn: "" };
    for (const lang of ["en", "hi", "kn"] as const) ids[lang] = await ttsCached(ai, cache, text, lang);

    assert.equal(new Set(Object.values(ids)).size, 3, "each language needs its own media id");
    assert.deepEqual(asked.map((a) => a.lang), ["en", "hi", "kn"]);

    for (const lang of ["en", "hi", "kn"] as const) {
      const stored = await media.get(ids[lang]);
      assert.equal(stored?.data.toString(), `spoken-in-${CODES[lang]}`, `${lang} must keep its own recording`);
      assert.equal(stored?.mime, "audio/mpeg");
    }
  });

  it("re-uses the cached recording instead of asking again", async () => {
    const store = new MemoryStore();
    const cache = new TtsCache(new MediaStore(store, "secret"));
    const { ai, asked } = fakeAi();

    const first = await ttsCached(ai, cache, "ನಮಸ್ಕಾರ", "kn");
    const again = await ttsCached(ai, cache, "ನಮಸ್ಕಾರ", "kn");
    assert.equal(again, first);
    assert.equal(asked.length, 1, "the second time must come from the cache");

    // "speak slower" is a different recording of the same words
    const slow = await ttsCached(ai, cache, "ನಮಸ್ಕಾರ", "kn", 0.75);
    assert.notEqual(slow, first);
    assert.deepEqual(asked.map((a) => a.pace), [1, 0.75]);
  });
});
