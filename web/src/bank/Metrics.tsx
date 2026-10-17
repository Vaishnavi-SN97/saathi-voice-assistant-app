import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../lib/api";
import { bankApi, fmt } from "./types";

interface MetricsResponse {
  tiles: {
    applicationsToday: number;
    firstVisitApprovalRate: number | null;
    averageMinutes: number | null;
    baselineMinutes: number;
    minutesSaved: number | null;
    mistakesCaught: number;
    scamBlocks: number;
  };
  counts: { applications: number; demo: number; included: number };
  includesDemo: boolean;
  generatedAt: string;
}

function Tile({ label, value, sub, demo }: { label: string; value: string; sub?: string; demo: boolean }) {
  return (
    <div className="bank-tile">
      <span className="bank-tile-label">{label}</span>
      <strong className="bank-tile-value">{value}</strong>
      {sub && <span className="bank-tile-sub">{sub}</span>}
      {demo && <span className="bank-chip bank-chip--warn bank-tile-demo">demo data</span>}
    </div>
  );
}

/** Number tiles only (no charts). Refreshes every 30 seconds. */
export function BankMetrics() {
  const [data, setData] = useState<MetricsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [excludeDemo, setExcludeDemo] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await bankApi<MetricsResponse>(`/metrics${excludeDemo ? "?demo=exclude" : ""}`));
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError && e.status === 403 ? "Your account is not allowed to see the numbers." : e instanceof ApiError && e.status === 0 ? "Cannot reach the server. Check the connection." : "Could not load the numbers.");
    }
  }, [excludeDemo]);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(t);
  }, [load]);

  const t = data?.tiles;
  const demo = data?.includesDemo ?? false;
  const avgSub = t?.averageMinutes == null ? "no completed applications yet" : `vs ${t.baselineMinutes} min on paper${t.minutesSaved != null ? (t.minutesSaved >= 0 ? ` · about ${t.minutesSaved} min saved` : ` · ${-t.minutesSaved} min slower`) : ""}`;

  return (
    <div>
      <div className="bank-title-row">
        <h1>Numbers</h1>
        <button type="button" className="bank-btn bank-btn--ghost" onClick={() => void load()}>Refresh</button>
      </div>

      {error && <p className="bank-notice bank-notice--warn" role="alert">{error} <button type="button" className="bank-link" onClick={() => void load()}>Try again</button></p>}
      {!data && !error && <div className="bank-spinner" role="status" aria-label="Loading" />}

      {data && t && (
        <>
          {data.counts.demo > 0 && (
            <p className={`bank-notice ${demo ? "bank-notice--warn" : "bank-notice--ok"}`}>
              {demo
                ? `Demo data is included: ${data.counts.demo} of ${data.counts.applications} applications are seeded samples, not real customers.`
                : `Showing real applications only (${data.counts.demo} demo ${data.counts.demo === 1 ? "application is" : "applications are"} hidden).`}{" "}
              <button type="button" className="bank-link" onClick={() => setExcludeDemo((v) => !v)}>{excludeDemo ? "Include demo data" : "Show real data only"}</button>
            </p>
          )}

          <div className="bank-tiles">
            <Tile label="Applications today" value={String(t.applicationsToday)} sub="started since midnight (IST)" demo={demo} />
            <Tile label="First-visit approval rate" value={t.firstVisitApprovalRate == null ? "-" : `${t.firstVisitApprovalRate}%`} sub="approved without being sent back" demo={demo} />
            <Tile label="Average time to a complete application" value={t.averageMinutes == null ? "-" : `${t.averageMinutes} min`} sub={avgSub} demo={demo} />
            <Tile label="Mistakes caught" value={String(t.mistakesCaught)} sub="found by Saathi before the counter" demo={demo} />
            <Tile label="Scam attempts blocked" value={String(t.scamBlocks)} sub="OTP / PIN shared by voice or text" demo={demo} />
          </div>
          <p className="bank-muted">Updated {fmt(data.generatedAt)} · {data.counts.included} applications counted</p>
        </>
      )}
    </div>
  );
}

export default BankMetrics;
