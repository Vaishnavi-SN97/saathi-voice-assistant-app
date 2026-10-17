import { api } from "../lib/api";
import { getBankToken } from "./firebase";

/** applications/{id} as the bank sees it. */
export interface BankApp {
  id: string;
  status: Status;
  language?: string;
  customerUid?: string;
  answers?: Record<string, { value?: unknown; valueEn?: string | null; confidence?: number; confirmed?: boolean }>;
  documents?: Partial<Record<DocKind, DocData>>;
  mismatches?: Mismatch[];
  readiness?: { score?: number; quickApprove?: boolean; eligible?: boolean; items?: ReadinessItem[] };
  review?: { decision?: string; note?: string | null; noteTranslated?: string | null; at?: string; by?: string };
  notify?: { consent?: boolean; phone?: string | null };
  metrics?: { startedAt?: string; readyAt?: string; approvedAt?: string; signedAt?: string; mistakesCaught?: number; scamBlocks?: number };
  qr?: { jti?: string; expiresAt?: string; usedAt?: string | null };
  updatedAt?: string;
}

export type Status = "draft" | "docs_pending" | "needs_fix" | "ready_for_review" | "approved" | "sent_back" | "signed";
export type DocKind = "aadhaar" | "pan" | "passbook";
export const DOC_KINDS: DocKind[] = ["aadhaar", "pan", "passbook"];

export interface DocData {
  fields?: Record<string, string | null>;
  confidence?: Record<string, number>;
  aadhaarLast4?: string | null;
  valid?: boolean;
  blurry?: boolean;
  uploadedAt?: string;
}
export interface Mismatch { code: string; severity: "warn" | "block"; message?: { en?: string }; doc?: DocKind; detail?: Record<string, string> }
export interface ReadinessItem { id: string; max: number; points: number; done: boolean; todo?: { en?: string } }
export interface AuditEntry { id: string; at?: string; actor?: string; action?: string; detail?: Record<string, unknown> }

/** The AI proposes, a human decides: below this a field is shown in amber so the banker double-checks it. */
export const LOW_CONFIDENCE = 0.8;

/** API call as the signed-in banker. */
export const bankApi = <T = unknown>(path: string, opts: Parameters<typeof api>[1] = {}) =>
  api<T>(path, { ...opts, tokenProvider: getBankToken });

export const STATUS_LABEL: Record<Status, string> = {
  draft: "Draft",
  docs_pending: "Documents pending",
  needs_fix: "Needs fix",
  ready_for_review: "Ready for review",
  approved: "Approved",
  sent_back: "Sent back",
  signed: "Signed",
};

export const FIELD_LABEL: Record<string, string> = {
  full_name: "Full name",
  dob: "Date of birth",
  mobile: "Mobile",
  address: "Address",
  occupation: "Occupation",
  nominee_name: "Nominee name",
  nominee_relation: "Nominee relation",
  notify_consent: "WhatsApp updates",
};
export const DOC_LABEL: Record<DocKind, string> = { aadhaar: "Aadhaar", pan: "PAN card", passbook: "Passbook" };

export const appName = (a: BankApp) => String(a.answers?.full_name?.valueEn ?? a.answers?.full_name?.value ?? "") || "(name not given yet)";
export const shortId = (id: string) => `SAA-${id.slice(0, 6).toUpperCase()}`;
export const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "");

/** Value as a banker reads it. */
export function showAnswer(id: string, a: NonNullable<BankApp["answers"]>[string] | undefined): string {
  if (!a) return "";
  if (id === "notify_consent") return a.value ? "Yes" : "No";
  if (id === "dob" && typeof a.value === "string") return a.value.split("-").reverse().join("/");
  const v = a.valueEn ?? a.value;
  return String(v ?? "");
}
