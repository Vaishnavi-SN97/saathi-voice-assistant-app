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

interface Session {
  appId: string | null;
  /** Interview language, fixed when the application is created. */
  appLang: Language | null;
  question: Question | null;
  progress: Progress;
  start: (appId: string, lang: Language, q: Question) => void;
  setQuestion: (q: Question) => void;
  setProgress: (p: Progress) => void;
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
  const value = useMemo<Session>(
    () => ({
      appId, appLang, question, progress, setQuestion, setProgress,
      start: (id, lang, q) => { setAppId(id); setAppLang(lang); setQuestion(q); setProgress({ done: 0, total: 8 }); },
      reset: () => { setAppId(null); setAppLang(null); setQuestion(null); setProgress({ done: 0, total: 8 }); },
    }),
    [appId, appLang, question, progress],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): Session {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSession outside SessionProvider");
  return v;
}
