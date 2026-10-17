import type { Lang } from "../form.js";

export type ShieldLevel = "none" | "warn" | "block";
export interface ShieldResult { level: ShieldLevel; flagged: boolean; reasons: string[]; text: string }

const WORD_DIGITS: Record<string, string> = {
  zero: "0", oh: "0", one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9",
  shunya: "0", ek: "1", do: "2", teen: "3", char: "4", chaar: "4", paanch: "5", panch: "5", chhe: "6", chah: "6",
  saat: "7", aath: "8", nau: "9",
  "शून्य": "0", "एक": "1", "दो": "2", "तीन": "3", "चार": "4", "पांच": "5", "पाँच": "5", "छह": "6", "छः": "6",
  "सात": "7", "आठ": "8", "नौ": "9",
};

const KEYWORDS = {
  otp: /otp|one[\s-]?time[\s-]?(pass|code)|ओटीपी|वन टाइम|ಒಟಿಪಿ/,
  pin: /\bpin\b|पिन|ಪಿನ್/,
  cvv: /cvv|cvc|सीवीवी|ಸಿವಿವಿ/,
  aadhaar: /aadh?aa?r|आधार|ಆಧಾರ್/,
  card: /card|कार्ड|ಕಾರ್ಡ್/,
  password: /password|पासवर्ड|ಪಾಸ್‌?ವರ್ಡ್/,
};

export const SHIELD_WARNING: Record<Lang, string> = {
  en: "Never share your OTP, PIN, CVV or card number with anyone. Saathi will never ask for them.",
  hi: "अपना ओटीपी, पिन, सीवीवी या कार्ड नंबर किसी को न बताएं। साथी कभी इन्हें नहीं मांगता।",
  kn: "ನಿಮ್ಮ ಒಟಿಪಿ, ಪಿನ್, ಸಿವಿವಿ ಅಥವಾ ಕಾರ್ಡ್ ಸಂಖ್ಯೆಯನ್ನು ಯಾರಿಗೂ ಹೇಳಬೇಡಿ. ಸಾಥಿ ಅವುಗಳನ್ನು ಎಂದಿಗೂ ಕೇಳುವುದಿಲ್ಲ.",
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
    const joined = run.join("");
    // word-only runs need >=4 digits so ordinary prose ("one loan") is left alone
    if (run.length && (numeric || run.length >= 4)) { out.push(joined); i = j; }
    else { out.push(tokens[i]); i++; }
  }
  return out.join(" ");
}

export function scanText(text: string): ShieldResult {
  const n = normalize(text);
  const reasons = new Set<string>();
  let redacted = n;

  for (const m of n.matchAll(/\d{3,19}/g)) {
    const len = m[0].length, at = m.index!;
    const ctx = n.slice(Math.max(0, at - 40), at) + " " + n.slice(at + len, at + len + 20);
    let reason: string | null = null;
    if (len >= 4 && len <= 8 && KEYWORDS.otp.test(ctx)) reason = "otp_shared";
    else if (len >= 4 && len <= 6 && KEYWORDS.pin.test(ctx)) reason = "pin_shared";
    else if (len <= 4 && KEYWORDS.cvv.test(ctx)) reason = "cvv_shared";
    else if (len === 12) reason = "aadhaar_number";
    else if (len >= 13 && len <= 19 && (len === 16 || KEYWORDS.card.test(ctx))) reason = "card_number";
    if (reason) { reasons.add(reason); redacted = redacted.replace(m[0], "[REDACTED]"); }
  }

  if (reasons.size) return { level: "block", flagged: true, reasons: [...reasons], text: redacted };
  const mentioned = Object.entries(KEYWORDS)
    .filter(([k, re]) => k !== "card" && re.test(n))
    .map(([k]) => `${k}_mentioned`);
  if (mentioned.length) return { level: "warn", flagged: true, reasons: mentioned, text };
  return { level: "none", flagged: false, reasons: [], text };
}
