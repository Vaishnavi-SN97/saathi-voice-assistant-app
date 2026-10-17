import type { DocKind } from "./mismatches.js";

export type { DocKind };
export interface DocConfidence { name: number; dob: number; number: number; ifsc: number }

/**
 * Raw result of reading one document photo. `number` is the Aadhaar (12 digits) or PAN (10 chars) and is
 * transient: the Aadhaar number is reduced to last 4 + valid and never stored.
 */
export interface DocExtraction {
  name: string | null; // English / Latin script
  dob: string | null; // ISO YYYY-MM-DD
  number: string | null;
  ifsc: string | null; // passbook only
  confidence: DocConfidence;
  blurry: boolean;
}

export const emptyExtraction = (blurry = false): DocExtraction => ({
  name: null, dob: null, number: null, ifsc: null, confidence: { name: 0, dob: 0, number: 0, ifsc: 0 }, blurry,
});
