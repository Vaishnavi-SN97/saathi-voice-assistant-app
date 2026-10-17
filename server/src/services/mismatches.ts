import type { Lang } from "../form.js";
import { crossCheck, type PairResult, type Source, type SourceId } from "./matcher.js";

export const MISMATCH_CODES = [
  "NAME_SPELLED_DIFFERENTLY", "NAME_MISMATCH", "DOB_MISMATCH", "AADHAAR_INVALID", "PAN_INVALID", "IFSC_INVALID", "PHOTO_BLURRY", "DOC_MISSING",
] as const;
export type MismatchCode = (typeof MISMATCH_CODES)[number];
export type Severity = "warn" | "block";
export type Msg = Record<Lang, string>;
export interface Mismatch { code: MismatchCode; severity: Severity; message: Msg; doc?: DocKind; detail?: Record<string, string> }

export const DOC_KINDS = ["aadhaar", "pan", "passbook"] as const;
export type DocKind = (typeof DOC_KINDS)[number];

export const DOC_LABEL: Record<DocKind, Msg> = {
  aadhaar: { en: "Aadhaar", hi: "आधार", kn: "ಆಧಾರ್" },
  pan: { en: "PAN card", hi: "पैन कार्ड", kn: "ಪ್ಯಾನ್ ಕಾರ್ಡ್" },
  passbook: { en: "passbook", hi: "पासबुक", kn: "ಪಾಸ್‌ಬುಕ್" },
};

export const SEVERITY: Record<MismatchCode, Severity> = {
  NAME_SPELLED_DIFFERENTLY: "warn",
  NAME_MISMATCH: "block",
  DOB_MISMATCH: "block",
  AADHAAR_INVALID: "block",
  PAN_INVALID: "block",
  IFSC_INVALID: "block",
  PHOTO_BLURRY: "block",
  DOC_MISSING: "block",
};

// {doc} is replaced with the localized document name. hi / kn wording needs a native-speaker check.
const TEMPLATE: Record<MismatchCode, Msg> = {
  NAME_SPELLED_DIFFERENTLY: {
    en: "Your name on the {doc} is spelled a little differently. Please choose the correct spelling.",
    hi: "आपका नाम दो अलग तरह से लिखा है। कौन सा सही है?",
    kn: "ನಿಮ್ಮ ಹೆಸರನ್ನು ಎರಡು ರೀತಿಯಲ್ಲಿ ಬರೆಯಲಾಗಿದೆ. ಯಾವುದು ಸರಿ?",
  },
  NAME_MISMATCH: {
    en: "The name on the {doc} does not match the name you told us. Please check.",
    hi: "{doc} पर लिखा नाम आपके बताए नाम से मेल नहीं खाता। कृपया जाँचें।",
    kn: "{doc} ನಲ್ಲಿರುವ ಹೆಸರು ನೀವು ಹೇಳಿದ ಹೆಸರಿಗೆ ಹೊಂದುತ್ತಿಲ್ಲ. ದಯವಿಟ್ಟು ಪರಿಶೀಲಿಸಿ.",
  },
  DOB_MISMATCH: {
    en: "The date of birth on the {doc} does not match what you told us.",
    hi: "{doc} पर जन्म तिथि आपके बताए अनुसार नहीं है।",
    kn: "{doc} ನಲ್ಲಿರುವ ಜನ್ಮ ದಿನಾಂಕ ನೀವು ಹೇಳಿದ್ದಕ್ಕೆ ಹೊಂದುತ್ತಿಲ್ಲ.",
  },
  AADHAAR_INVALID: {
    en: "The Aadhaar number could not be verified. Please take a clearer photo or check the card.",
    hi: "आधार नंबर सत्यापित नहीं हो सका। कृपया साफ़ फ़ोटो लें या कार्ड जाँचें।",
    kn: "ಆಧಾರ್ ಸಂಖ್ಯೆಯನ್ನು ಪರಿಶೀಲಿಸಲಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಸ್ಪಷ್ಟವಾದ ಫೋಟೋ ತೆಗೆಯಿರಿ ಅಥವಾ ಕಾರ್ಡ್ ಪರಿಶೀಲಿಸಿ.",
  },
  PAN_INVALID: {
    en: "The PAN number looks wrong. Please check the card or take a clearer photo.",
    hi: "पैन नंबर गलत लग रहा है। कृपया कार्ड जाँचें या साफ़ फ़ोटो लें।",
    kn: "ಪ್ಯಾನ್ ಸಂಖ್ಯೆ ತಪ್ಪಾಗಿ ಕಾಣುತ್ತಿದೆ. ದಯವಿಟ್ಟು ಕಾರ್ಡ್ ಪರಿಶೀಲಿಸಿ ಅಥವಾ ಸ್ಪಷ್ಟವಾದ ಫೋಟೋ ತೆಗೆಯಿರಿ.",
  },
  IFSC_INVALID: {
    en: "The bank IFSC code on the passbook looks wrong. Please take a clearer photo of the first page.",
    hi: "पासबुक पर बैंक का आईएफएससी कोड गलत लग रहा है। कृपया पहले पन्ने की साफ़ फ़ोटो लें।",
    kn: "ಪಾಸ್‌ಬುಕ್‌ನಲ್ಲಿರುವ ಬ್ಯಾಂಕ್ ಐಎಫ್‌ಎಸ್‌ಸಿ ಕೋಡ್ ತಪ್ಪಾಗಿ ಕಾಣುತ್ತಿದೆ. ದಯವಿಟ್ಟು ಮೊದಲ ಪುಟದ ಸ್ಪಷ್ಟ ಫೋಟೋ ತೆಗೆಯಿರಿ.",
  },
  PHOTO_BLURRY: {
    en: "The photo of the {doc} is blurry. Please take it again in good light.",
    hi: "{doc} की फ़ोटो धुंधली है। कृपया अच्छी रोशनी में फिर से लें।",
    kn: "{doc} ಫೋಟೋ ಮಂಜಾಗಿದೆ. ದಯವಿಟ್ಟು ಉತ್ತಮ ಬೆಳಕಿನಲ್ಲಿ ಮತ್ತೆ ತೆಗೆಯಿರಿ.",
  },
  DOC_MISSING: {
    en: "Please add the {doc}.",
    hi: "कृपया {doc} जोड़ें।",
    kn: "ದಯವಿಟ್ಟು {doc} ಸೇರಿಸಿ.",
  },
};

const LANGS: Lang[] = ["en", "hi", "kn"];

/** Localized message for a code; `doc` fills the {doc} placeholder. */
export function mismatchMessage(code: MismatchCode, doc?: DocKind): Msg {
  const out = {} as Msg;
  for (const l of LANGS) out[l] = TEMPLATE[code][l].replace("{doc}", doc ? DOC_LABEL[doc][l] : "");
  return out;
}

export const makeMismatch = (code: MismatchCode, doc?: DocKind, detail?: Record<string, string>): Mismatch => ({
  code,
  severity: SEVERITY[code],
  message: mismatchMessage(code, doc),
  ...(doc ? { doc } : {}),
  ...(detail ? { detail } : {}),
});

/* ---------- from an application document ---------- */

export interface AppLike {
  answers?: Record<string, { value?: unknown; valueEn?: string | null; confirmed?: boolean } | undefined>;
  documents?: Partial<Record<DocKind, { fields?: Record<string, any>; valid?: boolean; blurry?: boolean } | undefined>>;
  consent?: { at?: string };
  /** Set when the customer chose the correct spelling (POST /resolve-name): silences NAME_SPELLED_DIFFERENTLY. */
  nameResolved?: unknown;
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);

/** Names / DOBs from the confirmed answers and each uploaded document (English transliterations). */
export function sourcesFromApp(app: AppLike): Source[] {
  const a = app.answers ?? {};
  const out: Source[] = [];
  if (a.full_name?.confirmed || a.dob?.confirmed) {
    out.push({
      id: "answers",
      name: a.full_name?.confirmed ? str(a.full_name.valueEn) ?? str(a.full_name.value) : null,
      dob: a.dob?.confirmed ? str(a.dob.value) : null,
    });
  }
  for (const k of DOC_KINDS) {
    const f = app.documents?.[k]?.fields;
    if (!f) continue;
    out.push({ id: k, name: str(f.name) ?? str(f.holderName), dob: str(f.dob) });
  }
  return out;
}

export const pairsForApp = (app: AppLike): PairResult[] => crossCheck(sourcesFromApp(app));

const ORDER: Record<MismatchCode, number> = Object.fromEntries(MISMATCH_CODES.map((c, i) => [c, i])) as Record<MismatchCode, number>;

/** All mismatches for an application (deduplicated by code + document, blocking first). */
export function buildMismatches(app: AppLike): Mismatch[] {
  const found = new Map<string, Mismatch>();
  const add = (code: MismatchCode, doc?: DocKind, detail?: Record<string, string>) => {
    const key = `${code}:${doc ?? ""}`;
    if (!found.has(key)) found.set(key, makeMismatch(code, doc, detail));
  };

  for (const k of DOC_KINDS) {
    const d = app.documents?.[k];
    if (!d) { add("DOC_MISSING", k); continue; }
    if (d.blurry) add("PHOTO_BLURRY", k);
    if (d.valid === false && !d.blurry) add(k === "aadhaar" ? "AADHAAR_INVALID" : k === "pan" ? "PAN_INVALID" : "IFSC_INVALID", k);
  }

  // What the customer told us is the reference: judge each document against it. Document-vs-document pairs only
  // count for an attribute (name / dob) the customer has not given, so blame lands on the right document.
  const sources = sourcesFromApp(app);
  const ans = sources.find((s) => s.id === "answers");
  const src = (id: SourceId) => sources.find((s) => s.id === id);
  for (const p of pairsForApp(app)) {
    const doc: SourceId = p.b;
    if (doc === "answers") continue;
    if (p.a === "answers" || !ans?.name) {
      const names = { answerName: src(p.a)?.name ?? "", docName: src(doc)?.name ?? "" };
      if (p.name?.verdict === "mismatch") add("NAME_MISMATCH", doc, names);
      else if (p.name?.verdict === "spelled_differently" && !app.nameResolved) add("NAME_SPELLED_DIFFERENTLY", doc, names);
    }
    if ((p.a === "answers" || !ans?.dob) && p.dob === "mismatch") add("DOB_MISMATCH", doc, { answerDob: src(p.a)?.dob ?? "", docDob: src(doc)?.dob ?? "" });
  }

  for (const k of DOC_KINDS) if (found.has(`NAME_MISMATCH:${k}`)) found.delete(`NAME_SPELLED_DIFFERENTLY:${k}`);

  return [...found.values()].sort(
    (x, y) => Number(y.severity === "block") - Number(x.severity === "block") || ORDER[x.code] - ORDER[y.code],
  );
}
