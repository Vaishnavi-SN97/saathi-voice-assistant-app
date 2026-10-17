import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import sharp from "sharp";
import { runDocScenarios, type Scenario } from "../scripts/run-documents.js";
import { BLUR_THRESHOLD, laplacianVariance } from "./services/image-quality.js";

const DOCS = new URL("../assets/demo-docs/", import.meta.url);
const read = (f: string) => readFileSync(new URL(f, DOCS));

describe("image quality", () => {
  it("separates a sharp card from a blurred one", async () => {
    const sharpV = await laplacianVariance(read("clean/aadhaar.jpg"));
    const blurV = await laplacianVariance(await sharp(read("clean/aadhaar.jpg")).blur(9).toBuffer());
    assert.ok(sharpV > BLUR_THRESHOLD * 10, String(sharpV));
    assert.ok(blurV < BLUR_THRESHOLD, String(blurV));
  });
});

describe("documents: extract + check on the fake demo set (MOCK_AI)", async () => {
  const { scenarios, rejects } = await runDocScenarios();
  const by = (n: string) => scenarios.find((s) => s.name === n) as Scenario;

  it("clean set: score >= 90, no mismatches, eligible, still docs_pending", () => {
    const s = by("clean set");
    assert.ok(s.score >= 90, String(s.score));
    assert.deepEqual(s.codes, []);
    assert.equal(s.eligible, true);
    assert.equal(s.status, "docs_pending");
    assert.equal(s.mistakesCaught, 0);
  });

  it("clean set: only Aadhaar last 4 + valid are kept (never the number)", () => {
    const d = by("clean set").documents.aadhaar;
    assert.equal(d.aadhaarLast4, "0124");
    assert.equal(d.valid, true);
    assert.ok(!JSON.stringify(d).includes("234567890124"));
    assert.equal(by("clean set").leakedAadhaar, false);
    assert.equal(by("clean set").documents.pan.fields.pan, "ABCPS1234F");
  });

  it("name-variant set: NAME_SPELLED_DIFFERENTLY on the PAN, a warning only", () => {
    const s = by("name-variant set");
    assert.deepEqual(s.codes, ["NAME_SPELLED_DIFFERENTLY(pan)"]);
    assert.equal(s.eligible, true);
    assert.equal(s.mistakesCaught, 1);
  });

  it("blurry image: PHOTO_BLURRY, needs_fix; retake clears it without recounting the mistake", () => {
    const s = by("blurry aadhaar");
    assert.deepEqual(s.codes, ["PHOTO_BLURRY(aadhaar)"]);
    assert.equal(s.status, "needs_fix");
    assert.equal(s.eligible, false);
    assert.equal(s.mistakesCaught, 1);
    const r = by("blurry aadhaar, retaken");
    assert.deepEqual(r.codes, []);
    assert.equal(r.eligible, true);
    assert.equal(r.mistakesCaught, 1);
    assert.equal(r.score, 100);
  });

  it("invalid number image: AADHAAR_INVALID, needs_fix", () => {
    const s = by("invalid aadhaar number");
    assert.deepEqual(s.codes, ["AADHAAR_INVALID(aadhaar)"]);
    assert.equal(s.status, "needs_fix");
    assert.equal(s.documents.aadhaar.valid, false);
  });

  it("rejects non-images (415) and unauthenticated calls (401)", () => {
    assert.equal(rejects.notImage, 415);
    assert.equal(rejects.noAuth, 401);
  });
});
