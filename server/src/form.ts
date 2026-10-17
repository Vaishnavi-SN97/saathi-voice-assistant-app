import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export type Lang = "en" | "hi" | "kn";
export type LangCode = "en-IN" | "hi-IN" | "kn-IN";
export const LANGS: Lang[] = ["en", "hi", "kn"];
export const CODES: Record<Lang, LangCode> = { en: "en-IN", hi: "hi-IN", kn: "kn-IN" };

/** Accepts "hi" or "hi-IN" (any case); returns null if unsupported. */
export function toLang(x: unknown): Lang | null {
  const s = String(x ?? "").toLowerCase().split("-")[0];
  return (LANGS as string[]).includes(s) ? (s as Lang) : null;
}

export type FieldType = "name" | "date" | "mobile" | "text" | "choice" | "yesno";
export interface Option { value: string; label: Record<Lang, string> }
export interface Field {
  id: string;
  type: FieldType;
  required: boolean;
  label: Record<Lang, string>;
  prompt: Record<Lang, string>;
  options?: Option[];
}
export interface Form { version: number; consent: Record<Lang, string>; fields: Field[] }

export const form: Form = JSON.parse(readFileSync(fileURLToPath(new URL("../data/form.json", import.meta.url)), "utf8"));
