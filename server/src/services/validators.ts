// Pure validators (SPEC "Validators"). Keep only aadhaarLast4 + valid; never store the full Aadhaar number.

const D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 0, 6, 7, 8, 9, 5], [2, 3, 4, 0, 1, 7, 8, 9, 5, 6], [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8], [5, 9, 8, 7, 6, 0, 4, 3, 2, 1], [6, 5, 9, 8, 7, 1, 0, 4, 3, 2], [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4], [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 5, 7, 6, 2, 8, 3, 0, 9, 4], [5, 8, 0, 3, 7, 9, 6, 1, 4, 2], [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0], [4, 2, 8, 6, 5, 7, 3, 9, 0, 1], [2, 7, 9, 3, 8, 0, 6, 4, 1, 5], [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];
const INV = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9];

/** True if the digit string (check digit last) passes the Verhoeff checksum. */
export function verhoeffValid(num: string): boolean {
  if (!/^\d+$/.test(num)) return false;
  let c = 0;
  const digits = num.split("").reverse().map(Number);
  for (let i = 0; i < digits.length; i++) c = D[c][P[i % 8][digits[i]]];
  return c === 0;
}

/** Check digit to append to `base` so that base+digit passes verhoeffValid. */
export function verhoeffCheckDigit(base: string): number {
  let c = 0;
  const digits = base.split("").reverse().map(Number);
  for (let i = 0; i < digits.length; i++) c = D[c][P[(i + 1) % 8][digits[i]]];
  return INV[c];
}

const digitsOnly = (s: string) => s.replace(/[\s-]/g, "");

/** 12 digits, first digit 2-9, Verhoeff checksum. Accepts spaces/hyphens. */
export function isValidAadhaar(s: string): boolean {
  const d = digitsOnly(s);
  return /^[2-9]\d{11}$/.test(d) && verhoeffValid(d);
}
export const aadhaarLast4 = (s: string): string | null => {
  const d = digitsOnly(s);
  return /^\d{12}$/.test(d) ? d.slice(-4) : null;
};

/** ^[A-Z]{5}[0-9]{4}[A-Z]$ and the 4th letter is P (individual). */
export const isValidPan = (s: string): boolean => /^[A-Z]{3}P[A-Z][0-9]{4}[A-Z]$/.test(s.trim().toUpperCase());

/** ^[A-Z]{4}0[A-Z0-9]{6}$ */
export const isValidIfsc = (s: string): boolean => /^[A-Z]{4}0[A-Z0-9]{6}$/.test(s.trim().toUpperCase());

/** ^[6-9]\d{9}$ (optional +91 / 0 prefix and spaces are ignored). */
export const isValidMobile = (s: string): boolean => /^[6-9]\d{9}$/.test(digitsOnly(s).replace(/^(\+91|91|0)(?=\d{10}$)/, ""));

/** Age in whole years on `now` for an ISO date, or null if the date is not a real calendar date. */
export function ageOn(iso: string, now = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  let age = now.getUTCFullYear() - y;
  if (now.getUTCMonth() < mo - 1 || (now.getUTCMonth() === mo - 1 && now.getUTCDate() < d)) age--;
  return age;
}

/** SPEC: dob is a real date and age is 18-110. */
export const isValidDob = (iso: string, now = new Date()): boolean => {
  const a = ageOn(iso, now);
  return a !== null && a >= 18 && a <= 110;
};
