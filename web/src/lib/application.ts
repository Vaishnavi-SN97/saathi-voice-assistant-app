import { useEffect, useState } from "react";
import { NotConfiguredError, watchApplication } from "./firebase";

/** The parts of applications/{id} the customer screens read. */
export interface LiveApplication {
  status: "draft" | "docs_pending" | "needs_fix" | "ready_for_review" | "approved" | "sent_back" | "signed";
  language?: string;
  metrics?: { readyAt?: string; approvedAt?: string; signedAt?: string };
  review?: { decision?: string; note?: string | null; noteTranslated?: string | null; at?: string };
  notify?: { consent?: boolean; phone?: string | null };
  qr?: { jti?: string; expiresAt?: string; usedAt?: string | null; token?: string };
}

export type LiveError = "not_configured" | "permission" | "network" | "missing";

/**
 * Subscribes to the application with Firestore onSnapshot, so every change the bank makes shows up at once.
 * `error` is set when the listener cannot start or is cut off; `retry()` restarts it.
 */
export function useApplication(appId: string | null) {
  const [app, setApp] = useState<LiveApplication | null>(null);
  const [error, setError] = useState<LiveError | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!appId) return;
    setLoading(true);
    setError(null);
    return watchApplication(
      appId,
      (data) => {
        setLoading(false);
        setError(data ? null : "missing");
        setApp(data as LiveApplication | null);
      },
      (e) => {
        setLoading(false);
        const code = (e as { code?: string })?.code;
        setError(e instanceof NotConfiguredError ? "not_configured" : code === "permission-denied" ? "permission" : "network");
      },
    );
  }, [appId, attempt]);

  return { app, error, loading, retry: () => setAttempt((n) => n + 1) };
}

/** Short, readable application number for the customer ("SAA-1A2B3C"). */
export const shortId = (appId: string) => `SAA-${appId.slice(0, 6).toUpperCase()}`;

/** Placeholder branch from the design; P12 seeds the real one. */
export const BRANCH = {
  name: "Manipal Co-operative Bank, Udupi Main Branch",
  phoneDisplay: "0820-2520111",
  phoneTel: "+918202520111",
};

export const fmtDateTime = (iso?: string, lang: string = "en") =>
  iso ? new Date(iso).toLocaleString(lang === "hi" ? "hi-IN" : lang === "kn" ? "kn-IN" : "en-IN", { dateStyle: "medium", timeStyle: "short" }) : "";
