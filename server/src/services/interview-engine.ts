import type { Ctx } from "../app.js";
import { audit } from "../audit.js";
import type { AuthUser } from "../auth.js";
import { AppError } from "../errors.js";
import { form, toLang, type Field, type Lang } from "../form.js";
import { assertTransition } from "../status.js";
import { ttsCached } from "./sarvam.js";
import { SHIELD_WARNING, scanText } from "./scam-shield.js";
import { classifyYesNo, type YesNo } from "./yesno.js";

export { classifyYesNo };
export type { YesNo };

/** SPEC: max 2 retries (confidence < 0.6 or invalid), then offer typing. */
export const MAX_RETRIES = 2;
export const MIN_CONFIDENCE = 0.6;

export interface Answer { value: string | number | boolean; valueEn: string | null; confidence: number; confirmed: boolean }
export type Answers = Record<string, Answer>;

/* ---------- field order: deterministic, the LLM never picks the next question ---------- */

/** First required field that is not yet confirmed. */
export const nextField = (answers: Answers): Field | null =>
  form.fields.find((f) => f.required && !answers[f.id]?.confirmed) ?? null;

/* ---------- validation ---------- */

function validDob(iso: string, now = new Date()): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return false;
  let age = now.getUTCFullYear() - y;
  if (now.getUTCMonth() < mo - 1 || (now.getUTCMonth() === mo - 1 && now.getUTCDate() < d)) age--;
  return age >= 18 && age <= 110;
}

/** Returns the cleaned value, or null if unusable for this field. */
export function validate(f: Field, raw: string | number | boolean | null, now = new Date()): string | boolean | null {
  if (raw === null || raw === undefined) return null;
  switch (f.type) {
    case "yesno":
      return typeof raw === "boolean" ? raw : null;
    case "choice": {
      const v = String(raw).trim().toLowerCase();
      return f.options?.some((o) => o.value === v) ? v : null;
    }
    case "mobile": {
      const d = String(raw).replace(/[\s-]/g, "").replace(/^(\+91|0)(?=\d{10}$)/, "");
      return /^[6-9]\d{9}$/.test(d) ? d : null;
    }
    case "date": {
      const s = String(raw).trim();
      return validDob(s, now) ? s : null;
    }
    case "name": {
      const s = String(raw).trim().replace(/\s+/g, " ");
      return s.length >= 2 && s.length <= 100 && /^[\p{L}\p{M}.'\- ]+$/u.test(s) ? s : null;
    }
    default: {
      const s = String(raw).trim().replace(/\s+/g, " ");
      return s.length >= 3 && s.length <= 200 ? s : null;
    }
  }
}

/* ---------- sentences (hi / kn need a native-speaker check) ---------- */

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
  yes: { en: "Yes", hi: "हाँ", kn: "ಹೌದು" },
  no: { en: "No", hi: "नहीं", kn: "ಇಲ್ಲ" },
} satisfies Record<string, Record<Lang, string>>;

/** Display text for a value in the applicant's language. */
export function display(f: Field, value: string | number | boolean, lang: Lang): string {
  if (f.type === "yesno") return value ? T.yes[lang] : T.no[lang];
  if (f.type === "choice") return f.options?.find((o) => o.value === value)?.label[lang] ?? String(value);
  if (f.type === "date") {
    const [y, m, d] = String(value).split("-");
    return `${d}-${m}-${y}`;
  }
  if (f.type === "mobile") return String(value).split("").join(" "); // digits read one by one
  return String(value);
}

/** Read-back sentence confirming what we understood. */
export function readBack(f: Field, value: string | number | boolean, lang: Lang): string {
  const label = f.label[lang], v = display(f, value, lang);
  if (lang === "hi") return `आपने ${label} बताया: ${v}। क्या यह सही है?`;
  if (lang === "kn") return `ನೀವು ${label} ಹೇಳಿದ್ದೀರಿ: ${v}. ಇದು ಸರಿಯೇ?`;
  return `You said ${label}: ${v}. Is that correct?`;
}

/* ---------- shared helpers ---------- */

async function loadApp(ctx: Ctx, user: AuthUser, appId: string) {
  const app = await ctx.store.get(`applications/${appId}`);
  if (!app) throw new AppError(404, "not_found", "Application not found");
  if (app.customerUid !== user.uid) throw new AppError(403, "forbidden", "Not your application");
  if (app.status !== "draft") throw new AppError(409, "not_draft", "Interview already finished");
  return { app, lang: toLang(app.language) ?? "en", answers: (app.answers ?? {}) as Answers };
}

export async function speak(ctx: Ctx, text: string, lang: Lang) {
  const id = await ttsCached(ctx.ai, ctx.ttsCache, text, lang);
  return { text, audioUrl: ctx.media.url(id) };
}

export const fieldOut = async (ctx: Ctx, f: Field, lang: Lang) => ({
  id: f.id,
  type: f.type,
  options: f.options?.map((o) => ({ value: o.value, label: o.label[lang] })),
  ...(await speak(ctx, f.prompt[lang], lang)),
});

const progress = (answers: Answers) => ({
  done: form.fields.filter((f) => answers[f.id]?.confirmed).length,
  total: form.fields.length,
});

const save = (ctx: Ctx, appId: string, app: Record<string, any>, patch: Record<string, any>) =>
  ctx.store.set(`applications/${appId}`, { ...app, ...patch, updatedAt: new Date().toISOString() });

/**
 * Scam-shield block: store nothing from the utterance, metrics.scamBlocks++,
 * audit WITHOUT content, return the warning (text + audio).
 */
export async function registerScamBlock(ctx: Ctx, user: AuthUser, appId: string, lang: Lang, reasons: string[], fieldId?: string) {
  const app = await ctx.store.get(`applications/${appId}`);
  if (app && app.customerUid === user.uid) {
    const metrics = { ...(app.metrics ?? {}), scamBlocks: (app.metrics?.scamBlocks ?? 0) + 1 };
    await ctx.store.set(`applications/${appId}`, { ...app, metrics });
  }
  await audit(ctx.store, user, "scam_shield.block", appId, { reasons, fieldId: fieldId ?? null });
  return { blocked: true as const, warning: await speak(ctx, SHIELD_WARNING[lang], lang) };
}

/* ---------- state machine ---------- */

/** Handle one utterance answering the current field. */
export async function handleAnswer(ctx: Ctx, user: AuthUser, appId: string, text: string, source: "voice" | "typed") {
  const { app, lang, answers } = await loadApp(ctx, user, appId);
  const f = nextField(answers);
  if (!f) throw new AppError(409, "no_field", "All fields are already confirmed");

  // 1. Scam shield first: nothing is extracted, stored or sent to an LLM when it blocks.
  const shield = scanText(text);
  if (shield.flagged) {
    return { state: "asking" as const, ...(await registerScamBlock(ctx, user, appId, lang, shield.reasons, f.id)), question: await fieldOut(ctx, f, lang) };
  }

  // 2. Gemini extraction (current field only) -> validate
  const ex = await ctx.extract.extractAnswer(f, text, lang);
  const value = validate(f, ex.value);
  const lowConfidence = source === "voice" && ex.confidence < MIN_CONFIDENCE;

  if (value === null || lowConfidence) {
    const attempts = (app.interview?.attempts ?? 0) + 1;
    const { [f.id]: _dropped, ...rest } = answers;
    await save(ctx, appId, app, { answers: rest, interview: { attempts } });
    const typingFallback = source === "voice" && attempts > MAX_RETRIES;
    return {
      state: "asking" as const,
      typingFallback,
      message: await speak(ctx, typingFallback ? T.typing[lang] : T.retry[lang], lang),
      question: await fieldOut(ctx, f, lang),
    };
  }

  // 3. Keep as unconfirmed and read it back
  const answer: Answer = { value, valueEn: ex.valueEn ?? (typeof value === "string" ? value : null), confidence: source === "typed" ? 1 : ex.confidence, confirmed: false };
  await save(ctx, appId, app, { answers: { ...answers, [f.id]: answer }, interview: { attempts: 0 } });
  return { state: "confirming" as const, fieldId: f.id, readback: await speak(ctx, readBack(f, value, lang), lang), value, progress: progress(answers) };
}

/** Handle the yes/no reply to a read-back. */
export async function handleConfirm(ctx: Ctx, user: AuthUser, appId: string, input: { text?: string; confirmed?: boolean }) {
  const { app, lang, answers } = await loadApp(ctx, user, appId);
  const f = nextField(answers);
  const pending = f ? answers[f.id] : undefined;
  if (!f || !pending) throw new AppError(409, "nothing_to_confirm", "No answer is awaiting confirmation");

  if (input.confirmed === undefined && input.text) {
    const shield = scanText(input.text);
    if (shield.flagged) {
      return { state: "confirming" as const, ...(await registerScamBlock(ctx, user, appId, lang, shield.reasons, f.id)), readback: await speak(ctx, readBack(f, pending.value, lang), lang) };
    }
  }

  const verdict: YesNo = input.confirmed !== undefined ? (input.confirmed ? "yes" : "no") : classifyYesNo(input.text ?? "");

  if (verdict === "unclear") {
    const attempts = (app.interview?.attempts ?? 0) + 1;
    await save(ctx, appId, app, { interview: { attempts } });
    return {
      state: "confirming" as const,
      fieldId: f.id,
      buttonFallback: attempts > MAX_RETRIES,
      message: await speak(ctx, T.yesno[lang], lang),
      readback: await speak(ctx, readBack(f, pending.value, lang), lang),
    };
  }

  if (verdict === "no") {
    // Discard the pending value; the next answer replaces it.
    const { [f.id]: _dropped, ...rest } = answers;
    await save(ctx, appId, app, { answers: rest, interview: { attempts: 0 } });
    return { state: "asking" as const, question: await fieldOut(ctx, f, lang) };
  }

  const confirmed: Answers = { ...answers, [f.id]: { ...pending, confirmed: true } };
  const next = nextField(confirmed);
  const patch: Record<string, any> = {
    answers: confirmed,
    interview: { attempts: 0 },
    notify: { phone: confirmed.mobile?.value ?? app.notify?.phone ?? null, consent: confirmed.notify_consent?.value === true },
  };
  await audit(ctx.store, user, "interview.field_confirmed", appId, { fieldId: f.id });

  if (next) {
    await save(ctx, appId, app, patch);
    return { state: "asking" as const, question: await fieldOut(ctx, next, lang), progress: progress(confirmed) };
  }

  assertTransition("draft", "docs_pending");
  await save(ctx, appId, app, { ...patch, status: "docs_pending" });
  await audit(ctx.store, user, "status.docs_pending", appId, { from: "draft" });
  return { state: "docs_pending" as const, status: "docs_pending", progress: progress(confirmed) };
}
