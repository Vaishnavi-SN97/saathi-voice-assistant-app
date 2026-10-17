import { form, type Lang } from "../form.js";
import { DOC_KINDS, DOC_LABEL, pairsForApp, type AppLike, type DocKind, type Msg } from "./mismatches.js";

// SPEC weights: required answers confirmed 35; 3 docs uploaded+clear 20; names match 15; DOB matches 10;
// Aadhaar/PAN/IFSC valid 10; nominee complete 5; consent 5.
export const WEIGHTS = { answers: 35, docs: 20, names: 15, dob: 10, ids: 10, nominee: 5, consent: 5 } as const;
export type ItemId = keyof typeof WEIGHTS;
export const QUICK_APPROVE_AT = 90;

export interface ReadinessItem { id: ItemId; max: number; points: number; done: boolean; todo?: Msg }
export interface Readiness { score: number; quickApprove: boolean; items: ReadinessItem[] }

const LANGS: Lang[] = ["en", "hi", "kn"];
const all = (f: (l: Lang) => string): Msg => Object.fromEntries(LANGS.map((l) => [l, f(l)])) as Msg;
const list = (kinds: DocKind[], l: Lang) => kinds.map((k) => DOC_LABEL[k][l]).join(", ");

// hi / kn to-do wording needs a native-speaker check.
const TODO = {
  answers: (n: number) => ({
    en: `Answer the remaining questions (${n} left).`,
    hi: `बाकी सवालों के जवाब दें (${n} बाकी)।`,
    kn: `ಉಳಿದ ಪ್ರಶ್ನೆಗಳಿಗೆ ಉತ್ತರಿಸಿ (${n} ಬಾಕಿ).`,
  }),
  docs: (kinds: DocKind[]) => all((l) => ({
    en: `Add or retake a clear photo of: ${list(kinds, "en")}.`,
    hi: `इनकी साफ़ फ़ोटो जोड़ें या दोबारा लें: ${list(kinds, "hi")}।`,
    kn: `ಇವುಗಳ ಸ್ಪಷ್ಟ ಫೋಟೋ ಸೇರಿಸಿ ಅಥವಾ ಮತ್ತೆ ತೆಗೆಯಿರಿ: ${list(kinds, "kn")}.`,
  })[l]),
  names: {
    en: "Fix the name so it is spelled the same on every document.",
    hi: "सभी दस्तावेज़ों पर नाम की वर्तनी एक जैसी करें।",
    kn: "ಎಲ್ಲಾ ದಾಖಲೆಗಳಲ್ಲಿ ಹೆಸರಿನ ಕಾಗುಣಿತವನ್ನು ಒಂದೇ ರೀತಿ ಮಾಡಿ.",
  },
  dob: {
    en: "Check your date of birth: it must match your documents.",
    hi: "अपनी जन्म तिथि जाँचें: यह दस्तावेज़ों से मेल खानी चाहिए।",
    kn: "ನಿಮ್ಮ ಜನ್ಮ ದಿನಾಂಕ ಪರಿಶೀಲಿಸಿ: ಅದು ದಾಖಲೆಗಳಿಗೆ ಹೊಂದಬೇಕು.",
  },
  ids: (kinds: DocKind[]) => all((l) => ({
    en: `Retake the photo of ${list(kinds, "en")} so the numbers can be checked.`,
    hi: `संख्याएँ जाँचने के लिए इनकी फ़ोटो फिर से लें: ${list(kinds, "hi")}।`,
    kn: `ಸಂಖ್ಯೆಗಳನ್ನು ಪರಿಶೀಲಿಸಲು ಇವುಗಳ ಫೋಟೋ ಮತ್ತೆ ತೆಗೆಯಿರಿ: ${list(kinds, "kn")}.`,
  })[l]),
  nominee: {
    en: "Complete the nominee's name and relation.",
    hi: "नामित व्यक्ति का नाम और रिश्ता पूरा करें।",
    kn: "ನಾಮನಿರ್ದೇಶಿತರ ಹೆಸರು ಮತ್ತು ಸಂಬಂಧ ಪೂರ್ಣಗೊಳಿಸಿ.",
  },
  consent: {
    en: "Give your consent to continue.",
    hi: "आगे बढ़ने के लिए अपनी सहमति दें।",
    kn: "ಮುಂದುವರಿಯಲು ನಿಮ್ಮ ಸಮ್ಮತಿ ನೀಡಿ.",
  },
} as const;

/** 0-100 readiness with plain to-dos. Pure: reads only answers, documents and consent. */
export function computeReadiness(app: AppLike): Readiness {
  const answers = app.answers ?? {};
  const docs = app.documents ?? {};
  const items: ReadinessItem[] = [];
  const push = (id: ItemId, points: number, done: boolean, todo?: Msg) =>
    items.push({ id, max: WEIGHTS[id], points: Math.round(points * 100) / 100, done, ...(done || !todo ? {} : { todo }) });

  // 1. required answers confirmed (35)
  const required = form.fields.filter((f) => f.required);
  const confirmed = required.filter((f) => answers[f.id]?.confirmed).length;
  push("answers", (WEIGHTS.answers * confirmed) / required.length, confirmed === required.length, TODO.answers(required.length - confirmed));

  // 2. three documents uploaded and clear (20)
  const notClear = DOC_KINDS.filter((k) => !docs[k] || docs[k]!.blurry);
  push("docs", (WEIGHTS.docs * (DOC_KINDS.length - notClear.length)) / DOC_KINDS.length, notClear.length === 0, TODO.docs(notClear));

  // 3. names match (15) and 4. DOB matches (10): need at least two sources to compare
  const pairs = pairsForApp(app);
  const namePairs = pairs.filter((p) => p.name);
  const worst = namePairs.some((p) => p.name!.verdict === "mismatch") ? "mismatch" : namePairs.some((p) => p.name!.verdict === "spelled_differently") && !app.nameResolved ? "spelled_differently" : "match";
  const namesOk = namePairs.length > 0 && worst === "match";
  push("names", namePairs.length === 0 ? 0 : worst === "match" ? WEIGHTS.names : worst === "spelled_differently" ? WEIGHTS.names / 2 : 0, namesOk, namePairs.length ? TODO.names : undefined);

  const dobPairs = pairs.filter((p) => p.dob);
  const dobOk = dobPairs.length > 0 && dobPairs.every((p) => p.dob === "match");
  push("dob", dobOk ? WEIGHTS.dob : 0, dobOk, dobPairs.length ? TODO.dob : undefined);

  // 5. Aadhaar / PAN / IFSC valid (10)
  const invalid = DOC_KINDS.filter((k) => docs[k]?.valid !== true);
  push("ids", (WEIGHTS.ids * (DOC_KINDS.length - invalid.length)) / DOC_KINDS.length, invalid.length === 0, invalid.some((k) => docs[k]) ? TODO.ids(invalid.filter((k) => docs[k])) : undefined);

  // 6. nominee complete (5) and 7. consent (5)
  const nomineeOk = !!answers.nominee_name?.confirmed && !!answers.nominee_relation?.confirmed;
  push("nominee", nomineeOk ? WEIGHTS.nominee : 0, nomineeOk, TODO.nominee);
  const consentOk = !!app.consent?.at;
  push("consent", consentOk ? WEIGHTS.consent : 0, consentOk, TODO.consent);

  const score = Math.round(items.reduce((s, i) => s + i.points, 0));
  return { score, quickApprove: score >= QUICK_APPROVE_AT && notClear.length === 0, items };
}
