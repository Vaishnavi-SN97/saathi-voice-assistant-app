// SPEC yes: हाँ, हां, सही, ಹೌದು, ಸರಿ, yes, correct, ok; no: नहीं, ना, ಇಲ್ಲ, ತಪ್ಪು, no. The sets below are supersets (extra colloquial words).
const YES = new Set([
  "yes", "yeah", "yep", "yup", "ok", "okay", "correct", "right", "sure", "true", "haan", "han", "haa", "ji", "sahi", "theek", "thik",
  "हाँ", "हां", "हा", "जी", "सही", "ठीक", "ज़रूर", "जरूर",
  "ಹೌದು", "ಹೌದ", "ಸರಿ", "ಓಕೆ", "ಸರಿಯಾಗಿದೆ",
]);
const NO = new Set([
  "no", "nope", "nah", "wrong", "incorrect", "not", "nahi", "nahin", "nai", "na", "galat",
  "नहीं", "नही", "ना", "गलत", "नहि",
  "ಇಲ್ಲ", "ಇಲ್ಲಾ", "ತಪ್ಪು", "ಬೇಡ",
]);

export type YesNo = "yes" | "no" | "unclear";

/** Any negative word wins ("no, that is not correct"); otherwise any affirmative word; else unclear. */
export function classifyYesNo(text: string): YesNo {
  const words = text.toLowerCase().normalize("NFKC").match(/[\p{L}\p{M}]+/gu) ?? [];
  if (words.some((w) => NO.has(w))) return "no";
  if (words.some((w) => YES.has(w))) return "yes";
  return "unclear";
}
