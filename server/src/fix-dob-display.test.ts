import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { form } from "./form.js";
import { display, formatDob, readBack } from "./services/interview-engine.js";

const dobField = form.fields.find((f) => f.id === "dob")!;

describe("date of birth is read back as day, month name, year", () => {
  it("names the month in each language, so 03 cannot be read as a day", () => {
    assert.equal(formatDob("1950-03-15", "en"), "15 March 1950");
    assert.equal(formatDob("1950-03-15", "hi"), "15 मार्च 1950");
    assert.equal(formatDob("1950-03-15", "kn"), "15 ಮಾರ್ಚ್ 1950");
    assert.equal(formatDob("1950-01-02", "en"), "2 January 1950"); // 02/01 vs 01/02 is now unambiguous
  });

  it("the confirm card and the spoken read-back use it", () => {
    assert.equal(display(dobField, "1950-03-15", "en"), "15 March 1950");
    assert.match(readBack(dobField, "1950-03-15", "en"), /15 March 1950/);
    assert.match(readBack(dobField, "1950-03-15", "hi"), /15 मार्च 1950/);
  });

  it("leaves anything that is not a plain ISO date alone", () => {
    assert.equal(formatDob("15/03/1950", "en"), "15/03/1950");
    assert.equal(formatDob("", "en"), "");
  });
});

describe("WhatsApp still goes out when the server is not public", () => {
  it("drops the attachment instead of failing the whole message", async () => {
    const { loadEnv } = await import("./env.js");
    const { MemoryStore } = await import("./store.js");
    const { MediaStore } = await import("./mediaStore.js");
    const { Notifier } = await import("./services/notify.js");

    const app = { language: "hi-IN", notify: { consent: true, phone: "9876543210" } };
    const creds = { MOCK_AI: "true", TWILIO_ACCOUNT_SID: "AC", TWILIO_AUTH_TOKEN: "t", TWILIO_WHATSAPP_FROM: "+14155238886" };
    const send = () => {
      const sent: any[] = [];
      const store = new MemoryStore();
      return { sent, store, make: (publicUrl: string) => new Notifier(loadEnv({ ...creds, PUBLIC_API_URL: publicUrl } as NodeJS.ProcessEnv), store, new MediaStore(store, "s"), async (m) => { sent.push(m); }) };
    };

    const local = send();
    assert.deepEqual(await local.make("http://localhost:8080").notify("a1", app, "approved", { mediaId: "qr-1" }), { sent: true });
    assert.equal(local.sent[0].mediaUrl, undefined, "localhost media must not be attached");
    assert.match(local.sent[0].body, /\S/);

    const live = send();
    await live.make("https://api.example.test").notify("a2", app, "approved", { mediaId: "qr-1" });
    assert.match(live.sent[0].mediaUrl[0], /^https:\/\/api\.example\.test\/media\/qr-1\?token=/);
  });
});

describe("Gemini model fallback (the free daily cap is per model)", () => {
  it("keeps the configured model first and always has spares behind it", async () => {
    const { DEFAULT_MODELS, modelOrder } = await import("./services/gemini.js");
    assert.ok(DEFAULT_MODELS.length >= 3, "one model alone means one daily cap");
    assert.deepEqual(modelOrder(undefined), DEFAULT_MODELS);
    assert.deepEqual(modelOrder(""), DEFAULT_MODELS);

    const chosen = modelOrder("gemini-3.1-flash-lite");
    assert.equal(chosen[0], "gemini-3.1-flash-lite", "GEMINI_MODEL must be tried first");
    assert.ok(chosen.length > 1, "fallbacks must remain");
    assert.equal(new Set(chosen).size, chosen.length, "no model may be tried twice");

    // a comma-separated list sets the whole order
    const list = modelOrder("a, b ,c");
    assert.deepEqual(list.slice(0, 3), ["a", "b", "c"]);
  });
});
