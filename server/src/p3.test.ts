import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadEnv } from "./env.js";
import { form } from "./form.js";
import { createExtractor } from "./services/gemini.js";
import { classifyYesNo, nextField, readBack, validate, type Answers } from "./services/interview-engine.js";

const f = (id: string) => form.fields.find((x) => x.id === id)!;
const ans = (confirmed: boolean): Answers[string] => ({ value: "x", valueEn: "x", confidence: 1, confirmed });

describe("yes/no classifier", () => {
  const cases: [string, string][] = [
    ["yes", "yes"], ["correct", "yes"], ["ok", "yes"], ["Yeah that is correct", "yes"], ["haan ji", "yes"], ["हाँ", "yes"], ["हां", "yes"], ["सही", "yes"],
    ["ಹೌದು", "yes"], ["ಸರಿ", "yes"],
    ["no", "no"], ["नहीं", "no"], ["ना", "no"], ["ಇಲ್ಲ", "no"], ["ತಪ್ಪು", "no"], ["no that is not correct", "no"], ["haan nahi", "no"],
    ["", "unclear"], ["maybe tomorrow", "unclear"], ["Ramesh", "unclear"],
  ];
  for (const [t, want] of cases) it(`${JSON.stringify(t)} -> ${want}`, () => assert.equal(classifyYesNo(t), want));
});

describe("next-field logic (first required unconfirmed field; SPEC order)", () => {
  it("follows form.json order and has the SPEC fields", () => {
    assert.deepEqual(form.fields.map((x) => x.id), ["full_name", "dob", "mobile", "address", "occupation", "nominee_name", "nominee_relation", "notify_consent"]);
    assert.equal(nextField({})?.id, "full_name");
  });
  it("skips confirmed fields but not unconfirmed ones", () => {
    assert.equal(nextField({ full_name: ans(true) })?.id, "dob");
    assert.equal(nextField({ full_name: ans(true), dob: ans(false) })?.id, "dob");
    assert.equal(nextField({ full_name: ans(true), mobile: ans(true) })?.id, "dob");
  });
  it("returns null when every field is confirmed", () => {
    assert.equal(nextField(Object.fromEntries(form.fields.map((x) => [x.id, ans(true)]))), null);
  });
});

describe("validate + read-back", () => {
  const now = new Date("2026-10-17T00:00:00Z");
  it("validates each field type", () => {
    assert.equal(validate(f("full_name"), "  Ramesh   Shetty ", now), "Ramesh Shetty");
    assert.equal(validate(f("full_name"), "R2D2", now), null);
    assert.equal(validate(f("dob"), "1950-03-15", now), "1950-03-15");
    assert.equal(validate(f("dob"), "2015-03-15", now), null); // under 18
    assert.equal(validate(f("dob"), "1900-01-01", now), null); // over 110
    assert.equal(validate(f("dob"), "1950-02-31", now), null);
    assert.equal(validate(f("mobile"), "98765 43210", now), "9876543210");
    assert.equal(validate(f("mobile"), "5876543210", now), null);
    assert.equal(validate(f("occupation"), "Retired", now), "retired");
    assert.equal(validate(f("occupation"), "astronaut", now), null);
    assert.equal(validate(f("notify_consent"), true, now), true);
    assert.equal(validate(f("notify_consent"), "yes", now), null);
  });
  it("reads back in all three languages", () => {
    assert.match(readBack(f("dob"), "1950-03-15", "en"), /15 March 1950/); // month name: see fix-dob-display.test.ts
    assert.match(readBack(f("occupation"), "retired", "hi"), /सेवानिवृत्त/);
    assert.match(readBack(f("occupation"), "retired", "kn"), /ನಿವೃತ್ತ/);
    assert.match(readBack(f("mobile"), "9876543210", "en"), /9 8 7 6 5 4 3 2 1 0/);
  });
});

// Opt-in: the free Gemini tier allows only ~20 requests/day, so run with RUN_REAL_AI=1 when you want these.
describe("Gemini (real, needs GEMINI_API_KEY and RUN_REAL_AI=1)", { skip: !process.env.GEMINI_API_KEY || !process.env.RUN_REAL_AI }, () => {
  const ex = createExtractor(loadEnv({ ...process.env, MOCK_AI: "false" } as NodeJS.ProcessEnv));
  it("extracts a Hindi occupation as a choice with transliteration", { timeout: 60000 }, async () => {
    const r = await ex.extractAnswer(f("occupation"), "main kisan hoon", "hi");
    assert.equal(r.value, "farmer");
    assert.ok(r.confidence >= 0.6);
  });
  it("extracts and transliterates a Hindi name", { timeout: 60000 }, async () => {
    const r = await ex.extractAnswer(f("full_name"), "मेरा नाम रमेश शेट्टी है", "hi");
    console.log("real name:", JSON.stringify(r));
    assert.match(String(r.valueEn).toLowerCase(), /ramesh/);
  });
});
