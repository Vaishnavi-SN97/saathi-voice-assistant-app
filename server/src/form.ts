import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export type Lang = "en" | "hi" | "kn";
export interface Question { id: string; type: string; prompt: Record<Lang, string> }
export interface Form { version: number; consent: Record<Lang, string>; questions: Question[] }

export const form: Form = JSON.parse(readFileSync(fileURLToPath(new URL("../data/form.json", import.meta.url)), "utf8"));
export const LANGS: Lang[] = ["en", "hi", "kn"];
