import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { collection, onSnapshot } from "firebase/firestore";
import { bankDb } from "./firebase";
import { appName, fmt, shortId, STATUS_LABEL, type BankApp, type Status } from "./types";

type Tab = "review" | "progress" | "decided" | "all";
const TABS: { id: Tab; label: string; match: (s: Status) => boolean }[] = [
  { id: "review", label: "To review", match: (s) => s === "ready_for_review" },
  { id: "progress", label: "In progress", match: (s) => s === "docs_pending" || s === "needs_fix" },
  { id: "decided", label: "Decided", match: (s) => s === "approved" || s === "sent_back" || s === "signed" },
  { id: "all", label: "All", match: () => true },
];

export const StatusChip = ({ status }: { status: Status }) => <span className={`bank-chip bank-chip--${status}`}>{STATUS_LABEL[status] ?? status}</span>;

export function BankQueue() {
  const [apps, setApps] = useState<BankApp[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("review");
  const [attempt, setAttempt] = useState(0);

  // Live: any change a customer or the bank makes shows up here at once.
  useEffect(() => {
    setError(null);
    return onSnapshot(
      collection(bankDb(), "applications"),
      (snap) => setApps(snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as BankApp)),
      (e) =>
        setError(
          (e as { code?: string }).code === "permission-denied"
            ? "Firestore refused the read. Deploy firestore.rules and make sure this account has the banker claim."
            : "Cannot reach the live queue. Check your internet connection.",
        ),
    );
  }, [attempt]);

  const visible = useMemo(() => {
    const t = TABS.find((x) => x.id === tab)!;
    return (apps ?? [])
      .filter((a) => t.match(a.status) && (tab === "all" || a.status !== "draft"))
      // highest readiness first; ties: the one waiting longest
      .sort((a, b) => (b.readiness?.score ?? 0) - (a.readiness?.score ?? 0) || String(a.metrics?.readyAt ?? "").localeCompare(String(b.metrics?.readyAt ?? "")));
  }, [apps, tab]);

  const count = (id: Tab) => (apps ?? []).filter((a) => TABS.find((t) => t.id === id)!.match(a.status) && (id === "all" || a.status !== "draft")).length;

  return (
    <div>
      <div className="bank-title-row">
        <h1>Applications</h1>
        <span className="bank-live">● live</span>
      </div>

      <div className="bank-tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? "active" : ""} onClick={() => setTab(t.id)}>
            {t.label} <span className="bank-count">{count(t.id)}</span>
          </button>
        ))}
      </div>

      {error && (
        <p className="bank-notice bank-notice--warn" role="alert">
          {error} <button type="button" className="bank-link" onClick={() => setAttempt((n) => n + 1)}>Try again</button>
        </p>
      )}
      {apps === null && !error && <div className="bank-spinner" role="status" aria-label="Loading" />}
      {apps && visible.length === 0 && <p className="bank-empty">Nothing here right now.</p>}

      <ul className="bank-queue">
        {visible.map((a) => {
          const score = a.readiness?.score ?? 0;
          const blocks = (a.mismatches ?? []).filter((m) => m.severity === "block").length;
          const warns = (a.mismatches ?? []).filter((m) => m.severity === "warn").length;
          return (
            <li key={a.id}>
              <Link to={`/bank/app/${a.id}`} className="bank-row">
                <div className="bank-row-main">
                  <strong>{appName(a)}</strong>
                  <span className="bank-muted">{shortId(a.id)} · {a.language ?? ""} · {a.metrics?.readyAt ? `sent ${fmt(a.metrics.readyAt)}` : `started ${fmt(a.metrics?.startedAt)}`}</span>
                </div>
                <div className="bank-row-flags">
                  {a.readiness?.quickApprove && <span className="bank-badge-quick" title="Readiness 90+ with all documents clear">✓ Quick approve</span>}
                  {blocks > 0 && <span className="bank-chip bank-chip--needs_fix">{blocks} blocking</span>}
                  {warns > 0 && <span className="bank-chip bank-chip--warn">{warns} warning</span>}
                </div>
                <div className="bank-score" aria-label={`Readiness ${score} out of 100`}>
                  <div className="bank-score-bar"><span style={{ width: `${score}%` }} className={score >= 90 ? "high" : score >= 70 ? "mid" : "low"} /></div>
                  <b>{score}</b>
                </div>
                <StatusChip status={a.status} />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default BankQueue;
