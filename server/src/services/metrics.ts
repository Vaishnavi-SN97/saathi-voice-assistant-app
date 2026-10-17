// Number tiles for the bank dashboard. Pure: takes application documents, returns numbers.
import type { Doc } from "../store.js";

export interface Tiles {
  /** Applications started today (India time). */
  applicationsToday: number;
  /** Of applications that reached a bank decision, the share approved without ever being sent back (0-100), or null. */
  firstVisitApprovalRate: number | null;
  /** Average minutes from "started" to "sent to the bank" (complete, checked application), or null. */
  averageMinutes: number | null;
  baselineMinutes: number;
  /** baselineMinutes - averageMinutes (rounded), or null. */
  minutesSaved: number | null;
  mistakesCaught: number;
  scamBlocks: number;
}

export interface MetricsResult {
  tiles: Tiles;
  counts: { applications: number; demo: number; included: number };
  /** True when seeded demo rows are part of the numbers (the UI labels them "demo data"). */
  includesDemo: boolean;
  generatedAt: string;
}

const TZ = "Asia/Kolkata";
const day = (iso: string | Date) => new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ });
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const ms = (iso: unknown) => (typeof iso === "string" ? Date.parse(iso) : NaN);
const round1 = (n: number) => Math.round(n * 10) / 10;

export function computeMetrics(apps: Doc[], opts: { baselineMinutes: number; excludeDemo?: boolean; now?: Date }): MetricsResult {
  const now = opts.now ?? new Date();
  const all = apps.filter((a) => a.status !== undefined);
  const demo = all.filter((a) => a.demo === true).length;
  const used = opts.excludeDemo ? all.filter((a) => a.demo !== true) : all;
  const today = day(now);

  const started = used.filter((a) => typeof a.metrics?.startedAt === "string" && day(a.metrics.startedAt) === today).length;

  // Decided = approved / signed, or sent back at least once.
  const wasSentBack = (a: Doc) => num(a.metrics?.sentBackCount) > 0 || a.status === "sent_back";
  const approved = (a: Doc) => a.status === "approved" || a.status === "signed";
  const decided = used.filter((a) => approved(a) || wasSentBack(a));
  const firstTime = decided.filter((a) => approved(a) && !wasSentBack(a));

  const durations = used
    .map((a) => (ms(a.metrics?.readyAt) - ms(a.metrics?.startedAt)) / 60000)
    .filter((m) => Number.isFinite(m) && m >= 0);
  const avg = durations.length ? durations.reduce((s, m) => s + m, 0) / durations.length : null;

  return {
    tiles: {
      applicationsToday: started,
      firstVisitApprovalRate: decided.length ? Math.round((firstTime.length / decided.length) * 100) : null,
      averageMinutes: avg === null ? null : round1(avg),
      baselineMinutes: opts.baselineMinutes,
      minutesSaved: avg === null ? null : Math.round(opts.baselineMinutes - avg),
      mistakesCaught: used.reduce((s, a) => s + num(a.metrics?.mistakesCaught), 0),
      scamBlocks: used.reduce((s, a) => s + num(a.metrics?.scamBlocks), 0),
    },
    counts: { applications: all.length, demo, included: used.length },
    includesDemo: used.some((a) => a.demo === true),
    generatedAt: now.toISOString(),
  };
}
