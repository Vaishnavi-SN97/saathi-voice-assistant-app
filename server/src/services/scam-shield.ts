import type { Lang } from "../form.js";

export type ShieldLevel = "none" | "block";
export interface ShieldResult { level: ShieldLevel; flagged: boolean; reasons: string[]; text: string }

// SPEC: "Never share your OTP or PIN with anyone, not even with us." (hi/kn are translations: need a native check)
export const SHIELD_WARNING: Record<Lang, string> = {
  en: "Never share your OTP or PIN with anyone, not even with us.",
  hi: "अपना ओटीपी या पिन किसी को न बताएं, हमें भी नहीं।",
  kn: "ನಿಮ್ಮ ಒಟಿಪಿ ಅಥವಾ ಪಿನ್ ಅನ್ನು ಯಾರಿಗೂ ಹೇಳಬೇಡಿ, ನಮಗೂ ಹೇಳಬೇಡಿ.",
};

const WORD_DIGITS: Record<string, string> = {
  zero: "0", oh: "0", one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9",
  shunya: "0", ek: "1", do: "2", teen: "3", char: "4", chaar: "4", paanch: "5", panch: "5", chhe: "6", chah: "6",
  saat: "7", aath: "8", nau: "9",
  "शून्य": "0", "एक": "1", "दो": "2", "तीन": "3", "चार": "4", "पांच": "5", "पाँच": "5", "छह": "6", "छः": "6",
  "सात": "7", "आठ": "8", "नौ": "9",
};

// SPEC: block OTP, PIN, CVV, password, passcode, MPIN, UPI PIN, card number, or those words with a 4-6 digit sequence.
// "pin code" / "pincode" (an address field) is not a PIN.
const KEYWORDS: Record<string, RegExp> = {
  otp: /otp|one[\s-]?time[\s-]?(pass|code)|ओटीपी|ವನ್ ಟೈಮ್|ಒಟಿಪಿ/u,
  pin: /\bpin\b(?![\s-]*code)|\bmpin\b|upi[\s-]?pin|पिन(?![\s-]*कोड)|एमपिन|ಪಿನ್(?![\s-]*ಕೋಡ್)/u,
  cvv: /cvv|cvc|सीवीवी|ಸಿವಿವಿ/u,
  password: /pass[\s-]?(word|code)|पासवर्ड|पासकोड|ಪಾಸ್‌?ವರ್ಡ್/u,
  card_number: /card[\s-]?(number|no\b)|कार्ड नंबर|ಕಾರ್ಡ್ ಸಂಖ್ಯೆ/u,
};

function asciiDigits(s: string): string {
  return s.normalize("NFKC").replace(/[०-९೦-೯]/gu, (c) => {
    const cp = c.codePointAt(0)!;
    return String(cp >= 0x0ce6 ? cp - 0x0ce6 : cp - 0x0966);
  });
}

/** Lowercase, ascii-fy digits, and collapse runs of spoken/spaced digits ("4 8 2 9" / "four eight") into "4829". */
export function normalize(text: string): string {
  const tokens = asciiDigits(text).toLowerCase().split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < tokens.length; ) {
    const run: string[] = [];
    let numeric = false, j = i;
    for (; j < tokens.length; j++) {
      const t = tokens[j].replace(/^[-–,.]+|[-–,.]+$/gu, "");
      if (/^\d+$/.test(t)) { run.push(t); numeric = true; }
      else if (t in WORD_DIGITS) run.push(WORD_DIGITS[t]);
      else break;
    }
    // word-only runs need >=4 digits so ordinary prose ("one loan") is left alone
    if (run.length && (numeric || run.length >= 4)) { out.push(run.join("")); i = j; }
    else { out.push(tokens[i]); i++; }
  }
  return out.join(" ");
}

export function scanText(text: string): ShieldResult {
  const n = normalize(text);
  const reasons = new Set<string>();
  let redacted = n;

  const hits = Object.entries(KEYWORDS).filter(([, re]) => re.test(n)).map(([k]) => k);
  const hasDigits46 = [...n.matchAll(/(?<!\d)\d{4,6}(?!\d)/g)];
  for (const k of hits) reasons.add(hasDigits46.length ? `${k}_with_digits` : `${k}_mentioned`);
  if (hits.length) for (const m of hasDigits46) redacted = redacted.replace(m[0], "[REDACTED]");

  // A 13-19 digit run is treated as a card number even without a keyword.
  for (const m of n.matchAll(/(?<!\d)\d{13,19}(?!\d)/g)) {
    reasons.add("card_number_digits");
    redacted = redacted.replace(m[0], "[REDACTED]");
  }

  return reasons.size
    ? { level: "block", flagged: true, reasons: [...reasons], text: redacted }
    : { level: "none", flagged: false, reasons: [], text };
}
