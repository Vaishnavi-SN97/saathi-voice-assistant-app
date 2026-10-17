import type { Ctx } from "../app.js";
import { audit } from "../audit.js";
import type { AuthUser } from "../auth.js";
import { AppError } from "../errors.js";
import { form, type Lang, type Question } from "../form.js";
import { assertTransition } from "../status.js";
import { ttsCached } from "./sarvam.js";
import { SHIELD_WARNING, scanText } from "./scam-shield.js";

export const MAX_ATTEMPTS = 2;

/* ---------- yes / no classifier ---------- */

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

/* ---------- field order ---------- */

export const nextQuestion = (answers: Record<string, unknown>): Question | null =>
  form.questions.find((q) => !(q.id in answers)) ?? null;

/* ---------- sentences ---------- */

const T = {
  retry: {
    en: "Sorry, I didn't catch that. Please say it again.",
    hi: "माफ़ कीजिए, मैं समझ नहीं पाया। कृपया फिर से बोलें।",
    kn: "ಕ್ಷಮಿಸಿ, ನನಗೆ ಅರ್ಥವಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೊಮ್ಮೆ ಹೇಳಿ.",
  },
  yesno: {
    en: "Please say yes or no.",
    hi: "कृपया हाँ या नहीं बोलें।",
    kn: "ದಯವಿಟ್ಟು ಹೌದು ಅಥವಾ ಇಲ್ಲ ಎಂದು ಹೇಳಿ.",
  },
  typing: {
    en: "Let's type it instead.",
    hi: "आइए इसे टाइप करें।",
    kn: "ಇದನ್ನು ಟೈಪ್ ಮಾಡೋಣ.",
  },
} satisfies Record<string, Record<Lang, string>>;

const rupees: Record<Lang, string> = { en: "rupees", hi: "रुपये", kn: "ರೂಪಾಯಿ" };

/** Read-back sentence confirming what we understood, in the applicant's language. */
export function readBack(q: Question, value: string | number, lang: Lang): string {
  const label = q.label[lang];
  const v = q.type === "number" ? `${value} ${rupees[lang]}` : String(value);
  if (lang === "hi") return `आपने ${label} बताया: ${v}। क्या यह सही है?`;
  if (lang === "kn") return `ನೀವು ${label} ಹೇಳಿದ್ದೀರಿ: ${v}. ಇದು ಸರಿಯೇ?`;
  return `You said ${label}: ${v}. Is that correct?`;
}

/** Returns a clean value or null if the extracted value is unusable for this field. */
export function validate(q: Question, raw: string | number | null): string | number | null {
  if (raw === null || raw === undefined) return null;
  if (q.type === "number") {
    const n = typeof raw === "number" ? raw : Number(String(raw).replace(/[,\s]/g, ""));
    return Number.isInteger(n) && n > 0 && n <= 1_000_000_000 ? n : null;
  }
  const s = String(raw).trim().replace(/\s+/g, " ");
  return s.length >= 2 && s.length <= 100 ? s : null;
}

/* ---------- state machine ---------- */

interface Interview { state: "asking" | "confirming"; pending: { qid: string; value: string | number } | null; attempts: number }
const FRESH: Interview = { state: "asking", pending: null, attempts: 0 };

async function loadApp(ctx: Ctx, user: AuthUser, appId: string) {
  const app = await ctx.store.get(`applications/${appId}`);
  if (!app) throw new AppError(404, "not_found", "Application not found");
  if (app.ownerUid !== user.uid) throw new AppError(403, "forbidden", "Not your application");
  if (app.status !== "draft") throw new AppError(409, "not_draft", "Interview already finished");
  return app;
}

async function speak(ctx: Ctx, text: string, lang: Lang) {
  const id = await ttsCached(ctx.ai, ctx.ttsCache, text, lang);
  return { text, audioUrl: ctx.media.url(id) };
}

const questionOut = async (ctx: Ctx, q: Question, lang: Lang) => ({
  id: q.id,
  type: q.type,
  ...(await speak(ctx, q.prompt[lang], lang)),
});

const save = (ctx: Ctx, appId: string, app: Record<string, any>, patch: Record<string, any>) =>
  ctx.store.set(`applications/${appId}`, { ...app, ...patch, updatedAt: new Date().toISOString() });

/** Handle one utterance answering the current question. */
export async function handleAnswer(ctx: Ctx, user: AuthUser, appId: string, text: string, source: "voice" | "typed") {
  const app = await loadApp(ctx, user, appId);
  const lang: Lang = app.language;
  const q = form.questions.find((x) => x.id === app.currentQuestion)!;

  // Scam shield runs before anything is extracted, stored or sent to an LLM.
  const shield = scanText(text);
  if (shield.flagged) {
    await audit(ctx.store, user, `scam_shield.${shield.level}`, appId, { reasons: shield.reasons, questionId: q.id });
    return { state: "asking" as const, blocked: true, level: shield.level, warning: SHIELD_WARNING[lang], question: await questionOut(ctx, q, lang) };
  }

  const iv: Interview = app.interview ?? FRESH;
  const { value: raw } = await ctx.extract.extractAnswer(q, text, lang);
  const value = validate(q, raw);

  if (value === null) {
    const attempts = iv.attempts + 1;
    await save(ctx, appId, app, { interview: { state: "asking", pending: null, attempts } });
    const typingFallback = source === "voice" && attempts >= MAX_ATTEMPTS;
    return {
      state: "asking" as const,
      typingFallback,
      message: await speak(ctx, typingFallback ? T.typing[lang] : T.retry[lang], lang),
      question: await questionOut(ctx, q, lang),
    };
  }

  await save(ctx, appId, app, { interview: { state: "confirming", pending: { qid: q.id, value }, attempts: 0 } });
  return { state: "confirming" as const, readback: await speak(ctx, readBack(q, value, lang), lang), value };
}

/** Handle the yes/no reply to a read-back. */
export async function handleConfirm(ctx: Ctx, user: AuthUser, appId: string, input: { text?: string; confirmed?: boolean }) {
  const app = await loadApp(ctx, user, appId);
  const lang: Lang = app.language;
  const iv: Interview = app.interview ?? FRESH;
  if (iv.state !== "confirming" || !iv.pending) throw new AppError(409, "nothing_to_confirm", "No answer is awaiting confirmation");
  const q = form.questions.find((x) => x.id === iv.pending!.qid)!;

  if (input.confirmed === undefined && input.text) {
    const shield = scanText(input.text);
    if (shield.flagged) {
      await audit(ctx.store, user, `scam_shield.${shield.level}`, appId, { reasons: shield.reasons, questionId: q.id });
      return { state: "confirming" as const, blocked: true, level: shield.level, warning: SHIELD_WARNING[lang], readback: await speak(ctx, readBack(q, iv.pending.value, lang), lang) };
    }
  }

  const verdict: YesNo = input.confirmed !== undefined ? (input.confirmed ? "yes" : "no") : classifyYesNo(input.text ?? "");

  if (verdict === "unclear") {
    const attempts = iv.attempts + 1;
    await save(ctx, appId, app, { interview: { ...iv, attempts } });
    return {
      state: "confirming" as const,
      buttonFallback: attempts >= MAX_ATTEMPTS,
      message: await speak(ctx, T.yesno[lang], lang),
      readback: await speak(ctx, readBack(q, iv.pending.value, lang), lang),
    };
  }

  if (verdict === "no") {
    // Discard the pending value; the new answer replaces it on the next confirm.
    await save(ctx, appId, app, { interview: { state: "asking", pending: null, attempts: 0 } });
    return { state: "asking" as const, question: await questionOut(ctx, q, lang) };
  }

  const answers = { ...app.answers, [q.id]: iv.pending.value };
  const next = nextQuestion(answers);
  if (next) {
    await save(ctx, appId, app, { answers, currentQuestion: next.id, interview: { state: "asking", pending: null, attempts: 0 } });
    await audit(ctx.store, user, "interview.field_confirmed", appId, { questionId: q.id });
    return { state: "asking" as const, question: await questionOut(ctx, next, lang) };
  }

  assertTransition("draft", "docs_pending");
  await save(ctx, appId, app, { answers, currentQuestion: null, status: "docs_pending", interview: { state: "asking", pending: null, attempts: 0 } });
  await audit(ctx.store, user, "interview.field_confirmed", appId, { questionId: q.id });
  await audit(ctx.store, user, "status.docs_pending", appId, { from: "draft" });
  return { state: "docs_pending" as const, status: "docs_pending", answers };
}
