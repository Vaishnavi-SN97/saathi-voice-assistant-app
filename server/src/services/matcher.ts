// Name + DOB matching on English transliterations (SPEC "Name match").

export type NameVerdict = "match" | "spelled_differently" | "mismatch";
export interface NameResult { verdict: NameVerdict; score: number }

export const MATCH_AT = 0.93;
export const SPELLED_DIFFERENTLY_AT = 0.8;

/** Jaro-Winkler similarity in [0,1] (p = 0.1, common prefix up to 4, boost only when Jaro > 0.7). */
export function jaroWinkler(a: string, b: string): number {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  const window = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aMatched = new Array<boolean>(a.length).fill(false);
  const bMatched = new Array<boolean>(b.length).fill(false);
  let matches = 0;
  for (let i = 0; i < a.length; i++) {
    const lo = Math.max(0, i - window), hi = Math.min(b.length - 1, i + window);
    for (let j = lo; j <= hi; j++) {
      if (!bMatched[j] && a[i] === b[j]) { aMatched[i] = bMatched[j] = true; matches++; break; }
    }
  }
  if (!matches) return 0;
  let k = 0, half = 0;
  for (let i = 0; i < a.length; i++) {
    if (!aMatched[i]) continue;
    while (!bMatched[k]) k++;
    if (a[i] !== b[k]) half++;
    k++;
  }
  const t = half / 2;
  const jaro = (matches / a.length + matches / b.length + (matches - t) / matches) / 3;
  if (jaro <= 0.7) return jaro;
  let prefix = 0;
  while (prefix < 4 && prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) prefix++;
  return jaro + prefix * 0.1 * (1 - jaro);
}

const HONORIFICS = new Set(["mr", "mrs", "ms", "miss", "shri", "shree", "sri", "smt", "shrimati", "dr", "late"]);

/** Lowercase, strip punctuation and diacritics, drop honorifics; returns tokens. */
export function nameTokens(s: string): string[] {
  return s
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t && !HONORIFICS.has(t));
}

/**
 * Expand single-letter initials in `from` using full tokens of `other` ("R Shetty" vs "Ramesh Shetty").
 * A token already present in `from` is never reused as an expansion.
 */
function expandInitials(from: string[], other: string[]): { tokens: string[]; expanded: number } {
  const used = new Set(from.filter((t) => t.length > 1));
  let expanded = 0;
  const tokens = from.map((t) => {
    if (t.length !== 1) return t;
    const full = other.find((o) => o.length > 1 && o[0] === t && !used.has(o));
    if (!full) return t;
    used.add(full);
    expanded++;
    return full;
  });
  return { tokens, expanded };
}

const canon = (tokens: string[]) => [...tokens].sort().join(" ");

/**
 * SPEC: lowercase, strip punctuation, expand single-letter initials, sort tokens, Jaro-Winkler:
 * >= 0.93 match, 0.80-0.93 spelled_differently (warn), else mismatch (block).
 * A leftover initial that only one name has ("Ramesh K Shetty" vs "Ramesh Shetty") can never be a full match:
 * the names are at best spelled_differently.
 */
export function matchNames(a: string, b: string): NameResult {
  const ta = nameTokens(a), tb = nameTokens(b);
  if (!ta.length || !tb.length) return { verdict: "mismatch", score: 0 };
  const ea = expandInitials(ta, tb).tokens, eb = expandInitials(tb, ta).tokens;
  const score = jaroWinkler(canon(ea), canon(eb));

  const initials = (ts: string[]) => ts.filter((t) => t.length === 1).sort().join("");
  const extraInitial = initials(ea) !== initials(eb);

  let verdict: NameVerdict = score >= MATCH_AT ? "match" : score >= SPELLED_DIFFERENTLY_AT ? "spelled_differently" : "mismatch";
  if (verdict === "match" && extraInitial) verdict = "spelled_differently";
  return { verdict, score: Math.round(score * 1000) / 1000 };
}

/** Normalises ISO or DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY into YYYY-MM-DD; null if not parseable. */
export function normalizeDob(s: string): string | null {
  const t = s.trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/.exec(t);
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : null;
}

/** DOB must match exactly. null when either side is missing or unreadable. */
export function matchDob(a?: string | null, b?: string | null): "match" | "mismatch" | null {
  const x = a ? normalizeDob(a) : null, y = b ? normalizeDob(b) : null;
  if (!x || !y) return null;
  return x === y ? "match" : "mismatch";
}

/* ---------- cross-check: answers vs Aadhaar vs PAN vs passbook holder ---------- */

export type SourceId = "answers" | "aadhaar" | "pan" | "passbook";
export interface Source { id: SourceId; name?: string | null; dob?: string | null }
export interface PairResult { a: SourceId; b: SourceId; name: NameResult | null; dob: "match" | "mismatch" | null }

/** Compares every pair of available sources (names and DOBs). `b` is the later source in the list. */
export function crossCheck(sources: Source[]): PairResult[] {
  const out: PairResult[] = [];
  for (let i = 0; i < sources.length; i++) {
    for (let j = i + 1; j < sources.length; j++) {
      const a = sources[i], b = sources[j];
      out.push({
        a: a.id,
        b: b.id,
        name: a.name && b.name ? matchNames(a.name, b.name) : null,
        dob: matchDob(a.dob, b.dob),
      });
    }
  }
  return out;
}
