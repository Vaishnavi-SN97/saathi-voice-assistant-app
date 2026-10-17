import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { jaroWinkler, matchDob, matchNames, normalizeDob } from "./services/matcher.js";
import { buildMismatches, MISMATCH_CODES, mismatchMessage, type AppLike } from "./services/mismatches.js";
import { computeReadiness } from "./services/readiness.js";
import {
  aadhaarLast4, ageOn, isValidAadhaar, isValidDob, isValidIfsc, isValidMobile, isValidPan, verhoeffCheckDigit, verhoeffValid,
} from "./services/validators.js";

// small deterministic PRNG so failures are reproducible
let seed = 12345;
const rnd = (n: number) => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff), seed % n);
const makeAadhaar = () => {
  const base = String(2 + rnd(8)) + Array.from({ length: 10 }, () => rnd(10)).join("");
  return base + verhoeffCheckDigit(base);
};

describe("Verhoeff / Aadhaar", () => {
  it("accepts the textbook example 2363 (check digit 3)", () => {
    assert.equal(verhoeffCheckDigit("236"), 3);
    assert.ok(verhoeffValid("2363"));
    assert.ok(!verhoeffValid("2364"));
  });
  it("accepts 300 generated valid Aadhaar numbers", () => {
    for (let i = 0; i < 300; i++) {
      const a = makeAadhaar();
      assert.equal(a.length, 12);
      assert.ok(isValidAadhaar(a), a);
    }
  });
  it("rejects every single-digit change and adjacent swap of generated numbers", () => {
    for (let i = 0; i < 40; i++) {
      const a = makeAadhaar();
      for (let p = 0; p < 12; p++) {
        for (let d = 0; d < 10; d++) {
          if (String(d) === a[p]) continue;
          assert.ok(!verhoeffValid(a.slice(0, p) + d + a.slice(p + 1)), `${a} @${p}->${d}`);
        }
      }
      for (let p = 0; p < 11; p++) {
        if (a[p] === a[p + 1]) continue;
        assert.ok(!verhoeffValid(a.slice(0, p) + a[p + 1] + a[p] + a.slice(p + 2)), `${a} swap@${p}`);
      }
    }
  });
  it("rejects wrong length, leading 0/1, non-digits; accepts spaces", () => {
    const ok = makeAadhaar();
    assert.ok(isValidAadhaar(`${ok.slice(0, 4)} ${ok.slice(4, 8)} ${ok.slice(8)}`));
    assert.ok(!isValidAadhaar(ok.slice(1)));
    assert.ok(!isValidAadhaar(ok + "1"));
    assert.ok(!isValidAadhaar("0" + ok.slice(1)));
    assert.ok(!isValidAadhaar("1" + ok.slice(1)));
    assert.ok(!isValidAadhaar("23630000000A"));
    assert.equal(aadhaarLast4(ok), ok.slice(-4));
    assert.equal(aadhaarLast4("123"), null);
  });
});

describe("PAN / IFSC / mobile / age", () => {
  it("PAN: 4th letter must be P", () => {
    assert.ok(isValidPan("ABCPE1234F"));
    assert.ok(isValidPan(" abcpe1234f "));
    assert.ok(!isValidPan("ABCDE1234F"));
    assert.ok(!isValidPan("ABCPE12345"));
    assert.ok(!isValidPan("ABCPE1234"));
  });
  it("IFSC", () => {
    assert.ok(isValidIfsc("SBIN0001234"));
    assert.ok(isValidIfsc("hdfc0abc123"));
    assert.ok(!isValidIfsc("SBIN1001234"));
    assert.ok(!isValidIfsc("SBI0001234"));
  });
  it("mobile starts 6-9 and has 10 digits", () => {
    assert.ok(isValidMobile("9876543210"));
    assert.ok(isValidMobile("+91 98765 43210"));
    assert.ok(!isValidMobile("5876543210"));
    assert.ok(!isValidMobile("987654321"));
  });
  it("age 18-110", () => {
    const now = new Date("2026-10-17T00:00:00Z");
    assert.equal(ageOn("2008-10-17", now), 18);
    assert.equal(ageOn("2008-10-18", now), 17);
    assert.ok(isValidDob("2008-10-17", now));
    assert.ok(!isValidDob("2008-10-18", now));
    assert.ok(isValidDob("1916-10-17", now));
    assert.ok(!isValidDob("1915-10-17", now));
    assert.equal(ageOn("1950-02-30", now), null);
  });
});

describe("Jaro-Winkler", () => {
  it("matches reference values", () => {
    assert.equal(jaroWinkler("abc", "abc"), 1);
    assert.ok(Math.abs(jaroWinkler("martha", "marhta") - 0.9611) < 0.001);
    assert.ok(Math.abs(jaroWinkler("dixon", "dicksonx") - 0.8133) < 0.001);
    assert.equal(jaroWinkler("abc", "xyz"), 0);
    assert.equal(jaroWinkler("", "a"), 0);
  });
});

describe("name matcher", () => {
  it("Ramesh Shetty vs Ramesh K Shetty -> spelled_differently", () => {
    assert.equal(matchNames("Ramesh Shetty", "Ramesh K Shetty").verdict, "spelled_differently");
  });
  it("E Yashwanth Kumar vs Yashwanth Kumar E -> match", () => {
    const r = matchNames("E Yashwanth Kumar", "Yashwanth Kumar E");
    assert.equal(r.verdict, "match");
    assert.equal(r.score, 1);
  });
  it("case, punctuation and honorifics are ignored; initials are expanded", () => {
    assert.equal(matchNames("RAMESH  SHETTY", "Shri Ramesh Shetty").verdict, "match");
    assert.equal(matchNames("R. Shetty", "Ramesh Shetty").verdict, "match");
    assert.equal(matchNames("Shetty, Ramesh", "Ramesh Shetty").verdict, "match");
  });
  it("one-letter spelling variants are spelled_differently", () => {
    assert.equal(matchNames("Yashwanth Kumar", "Yashvanth Kumar").verdict, "match"); // JW >= 0.93
    assert.equal(matchNames("Lakshmi Devi", "Laxmi Devi").verdict, "spelled_differently");
  });
  it("clearly different names -> mismatch", () => {
    assert.equal(matchNames("Ramesh Shetty", "Sunita Patil").verdict, "mismatch");
    assert.equal(matchNames("Ramesh Shetty", "").verdict, "mismatch");
  });
});

describe("DOB matcher", () => {
  it("normalises and compares exactly", () => {
    assert.equal(normalizeDob("15/03/1950"), "1950-03-15");
    assert.equal(matchDob("1950-03-15", "15-03-1950"), "match");
    assert.equal(matchDob("1950-03-15", "1950-03-16"), "mismatch");
    assert.equal(matchDob("1950-03-15", null), null);
    assert.equal(matchDob("garbage", "1950-03-15"), null);
  });
});

/* ---------- fixtures ---------- */
const conf = (value: unknown, valueEn?: string) => ({ value, valueEn: valueEn ?? String(value), confidence: 1, confirmed: true });
const cleanApp = (): AppLike & Record<string, any> => ({
  consent: { at: "2026-10-17T00:00:00Z" },
  answers: {
    full_name: conf("रमेश शेट्टी", "Ramesh Shetty"), dob: conf("1950-03-15"), mobile: conf("9876543210"), address: conf("12 MG Road"),
    occupation: conf("retired"), nominee_name: conf("Sita Shetty"), nominee_relation: conf("spouse"), notify_consent: conf(true),
  },
  documents: {
    aadhaar: { fields: { name: "Ramesh Shetty", dob: "1950-03-15" }, valid: true, blurry: false },
    pan: { fields: { name: "RAMESH SHETTY", dob: "15/03/1950" }, valid: true, blurry: false },
    passbook: { fields: { name: "Mr Ramesh Shetty" }, valid: true, blurry: false },
  },
});

describe("readiness", () => {
  it("weights add up to 100 and a fully clean case scores 100 with quick-approve", () => {
    const r = computeReadiness(cleanApp());
    assert.equal(r.items.reduce((s, i) => s + i.max, 0), 100);
    assert.equal(r.score, 100);
    assert.ok(r.quickApprove);
    assert.ok(r.items.every((i) => i.done && !i.todo));
    assert.deepEqual(buildMismatches(cleanApp()), []);
  });

  it("a missing document scores lower, has a to-do, and DOC_MISSING", () => {
    const app = cleanApp();
    delete app.documents!.passbook;
    const r = computeReadiness(app);
    assert.ok(r.score < 100 && r.score >= 85, String(r.score));
    assert.ok(!r.quickApprove);
    const docs = r.items.find((i) => i.id === "docs")!;
    assert.equal(docs.done, false);
    assert.match(docs.todo!.en, /passbook/);
    assert.match(docs.todo!.hi, /पासबुक/);
    const m = buildMismatches(app);
    assert.deepEqual(m.map((x) => x.code), ["DOC_MISSING"]);
  });

  it("scores an empty application near zero with a to-do for each unfinished item", () => {
    const r = computeReadiness({});
    assert.equal(r.score, 0);
    assert.ok(r.items.filter((i) => !i.done).every((i) => i.id === "names" || i.id === "dob" || i.id === "ids" || i.todo));
  });

  it("a spelled-differently name halves the names points and warns", () => {
    const app = cleanApp();
    app.documents!.pan!.fields!.name = "RAMESH K SHETTY";
    const r = computeReadiness(app);
    assert.equal(r.items.find((i) => i.id === "names")!.points, 7.5);
    assert.ok(r.score < 100 && r.score >= 90);
    const m = buildMismatches(app);
    assert.equal(m.length, 1);
    assert.equal(m[0].code, "NAME_SPELLED_DIFFERENTLY");
    assert.equal(m[0].severity, "warn");
    assert.equal(m[0].doc, "pan");
  });

  it("different name + DOB on a document blocks and removes the points", () => {
    const app = cleanApp();
    app.documents!.aadhaar!.fields = { name: "Sunita Patil", dob: "1951-03-15" };
    const codes = buildMismatches(app).map((x) => x.code);
    assert.ok(codes.includes("NAME_MISMATCH") && codes.includes("DOB_MISMATCH"));
    assert.ok(!codes.includes("NAME_SPELLED_DIFFERENTLY"));
    const r = computeReadiness(app);
    assert.equal(r.items.find((i) => i.id === "names")!.points, 0);
    assert.equal(r.items.find((i) => i.id === "dob")!.points, 0);
  });

  it("blurry and invalid documents are reported", () => {
    const app = cleanApp();
    app.documents!.aadhaar = { ...app.documents!.aadhaar!, valid: false };
    app.documents!.pan = { ...app.documents!.pan!, blurry: true };
    app.documents!.passbook = { ...app.documents!.passbook!, valid: false };
    const codes = buildMismatches(app).map((x) => x.code).sort();
    assert.deepEqual(codes, ["AADHAAR_INVALID", "IFSC_INVALID", "PHOTO_BLURRY"]);
    const r = computeReadiness(app);
    assert.ok(r.items.find((i) => i.id === "ids")!.todo);
    assert.ok(r.items.find((i) => i.id === "docs")!.todo);
  });

  it("unconfirmed answers earn nothing", () => {
    const app = cleanApp();
    app.answers!.full_name = { ...app.answers!.full_name!, confirmed: false };
    app.answers!.nominee_name = { ...app.answers!.nominee_name!, confirmed: false };
    const r = computeReadiness(app);
    assert.ok(r.items.find((i) => i.id === "answers")!.points < 35);
    assert.equal(r.items.find((i) => i.id === "nominee")!.points, 0);
  });
});

describe("mismatch messages", () => {
  it("every code has non-empty en/hi/kn text with no leftover placeholder", () => {
    for (const code of MISMATCH_CODES) {
      const m = mismatchMessage(code, "aadhaar");
      for (const l of ["en", "hi", "kn"] as const) {
        assert.ok(m[l].length > 10, `${code} ${l}`);
        assert.ok(!m[l].includes("{doc}"), `${code} ${l}`);
      }
    }
    assert.match(mismatchMessage("PHOTO_BLURRY", "pan").hi, /पैन/);
  });
});
