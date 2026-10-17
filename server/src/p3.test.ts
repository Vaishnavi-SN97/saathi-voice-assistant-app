import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { form } from "./form.js";
import { classifyYesNo, nextQuestion, readBack, validate } from "./services/interview-engine.js";
import { createExtractor } from "./services/gemini.js";
import { loadEnv } from "./env.js";

describe("yes/no classifier", () => {
  const cases: [string, string][] = [
    ["yes", "yes"], ["Yeah that is correct", "yes"], ["haan ji", "yes"], ["हाँ, सही है", "yes"], ["ಹೌದು", "yes"], ["ಸರಿ", "yes"],
    ["no", "no"], ["nahi", "no"], ["नहीं, गलत है", "no"], ["ಇಲ್ಲ", "no"], ["no that is not correct", "no"], ["haan nahi", "no"],
    ["", "unclear"], ["maybe tomorrow", "unclear"], ["Ramesh", "unclear"],
  ];
  for (const [t, want] of cases) it(`${JSON.stringify(t)} -> ${want}`, () => assert.equal(classifyYesNo(t), want));
});

describe("next-field logic", () => {
  it("starts at the first question and skips answered ones", () => {
    assert.equal(nextQuestion({})?.id, form.questions[0].id);
    assert.equal(nextQuestion({ full_name: "A" })?.id, "occupation");
    assert.equal(nextQuestion({ full_name: "A", monthly_income: 1 })?.id, "occupation");
  });
  it("returns null when every field is answered", () => {
    const all = Object.fromEntries(form.questions.map((q) => [q.id, "x"]));
    assert.equal(nextQuestion(all), null);
  });
});

describe("validate + read-back", () => {
  const num = form.questions.find((q) => q.type === "number")!;
  const txt = form.questions[0];
  it("validates numbers and text", () => {
    assert.equal(validate(num, "15,000"), 15000);
    assert.equal(validate(num, -5), null);
    assert.equal(validate(num, 12.5), null);
    assert.equal(validate(txt, "  Ravi   Kumar "), "Ravi Kumar");
    assert.equal(validate(txt, null), null);
    assert.equal(validate(txt, "x"), null);
  });
  it("reads back in all three languages", () => {
    assert.match(readBack(num, 15000, "en"), /15000 rupees/);
    assert.match(readBack(num, 15000, "hi"), /15000 रुपये/);
    assert.match(readBack(num, 15000, "kn"), /15000 ರೂಪಾಯಿ/);
  });
});

describe("Gemini (real, needs GEMINI_API_KEY)", { skip: !process.env.GEMINI_API_KEY }, () => {
  it("extracts a Hindi income", { timeout: 60000 }, async () => {
    const ex = createExtractor(loadEnv({ ...process.env, MOCK_AI: "false" } as NodeJS.ProcessEnv));
    const r = await ex.extractAnswer(form.questions.find((q) => q.id === "monthly_income")!, "main mahine mein pandrah hazaar kamata hoon", "hi");
    assert.equal(r.value, 15000);
  });
});
