import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { Language } from "../types";

export interface Question {
  id: string;
  type: string;
  text: string;
  audioUrl: string;
  options?: { value: string; label: string }[];
}
export interface Progress { done: number; total: number }

export type DocKind = "aadhaar" | "pan" | "passbook";
export const DOC_KINDS: DocKind[] = ["aadhaar", "pan", "passbook"];

/** A problem found by the server (mismatches.ts); `message` is already in en / hi / kn. */
export interface Issue {
  code: string;
  severity: "warn" | "block";
  message: Record<Language, string>;
  doc?: DocKind;
  detail?: Record<string, string>;
}
export interface ReadinessItem { id: string; max: number; points: number; done: boolean; todo?: Record<Language, string> }
export interface CheckResult {
  status: string;
  eligible: boolean;
  mismatches: Issue[];
  readiness: { score: number; quickApprove: boolean; items: ReadinessItem[] };
}
/** What the server said about one uploaded photo. */
export interface DocState { valid: boolean; blurry: boolean; issues: Issue[] }

interface Session {
  appId: string | null;
  /** Interview language, fixed when the application is created. */
  appLang: Language | null;
  question: Question | null;
  progress: Progress;
  documents: Partial<Record<DocKind, DocState>>;
  check: CheckResult | null;
  start: (appId: string, lang: Language, q: Question) => void;
  setQuestion: (q: Question) => void;
  setProgress: (p: Progress) => void;
  setDocument: (kind: DocKind, d: DocState) => void;
  setCheck: (c: CheckResult | null) => void;
  reset: () => void;
}
const Ctx = createContext<Session | null>(null);

/** Server question payload -> UI question. */
export const toQuestion = (q: { id: string; type: string; text: string; audioUrl: string; options?: Question["options"] }): Question => ({
  id: q.id, type: q.type, text: q.text, audioUrl: q.audioUrl, options: q.options,
});

export function SessionProvider({ children }: { children: ReactNode }) {
  const [appId, setAppId] = useState<string | null>(null);
  const [appLang, setAppLang] = useState<Language | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [progress, setProgress] = useState<Progress>({ done: 0, total: 8 });
  const [documents, setDocuments] = useState<Partial<Record<DocKind, DocState>>>({});
  const [check, setCheck] = useState<CheckResult | null>(null);

  const value = useMemo<Session>(
    () => ({
      appId, appLang, question, progress, documents, check,
      setQuestion, setProgress, setCheck,
      setDocument: (kind, d) => setDocuments((prev) => ({ ...prev, [kind]: d })),
      start: (id, lang, q) => {
        setAppId(id); setAppLang(lang); setQuestion(q); setProgress({ done: 0, total: 8 }); setDocuments({}); setCheck(null);
      },
      reset: () => {
        setAppId(null); setAppLang(null); setQuestion(null); setProgress({ done: 0, total: 8 }); setDocuments({}); setCheck(null);
      },
    }),
    [appId, appLang, question, progress, documents, check],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): Session {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSession outside SessionProvider");
  return v;
}
