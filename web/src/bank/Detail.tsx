import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { collection, doc, onSnapshot, orderBy, query } from "firebase/firestore";
import { ApiError } from "../lib/api";
import { bankDb } from "./firebase";
import { StatusChip } from "./Queue";
import {
  appName, bankApi, DOC_KINDS, DOC_LABEL, FIELD_LABEL, fmt, LOW_CONFIDENCE, shortId, showAnswer,
  type AuditEntry, type BankApp, type DocData, type DocKind,
} from "./types";

type Load = "loading" | "ok" | "missing" | "error";

/** Fetches a protected file with the banker's ID token and exposes it as a blob URL (revoked on cleanup). */
function useBlob(path: string | null, version?: string) {
  const [state, setState] = useState<{ url: string | null; status: "loading" | "ok" | "missing" | "error" }>({ url: null, status: "loading" });
  useEffect(() => {
    if (!path) return;
    let cancelled = false, made: string | null = null;
    setState({ url: null, status: "loading" });
    bankApi<Blob>(path, { blob: true })
      .then((b) => {
        if (cancelled) return;
        made = URL.createObjectURL(b);
        setState({ url: made, status: "ok" });
      })
      .catch((e) => !cancelled && setState({ url: null, status: e instanceof ApiError && e.status === 404 ? "missing" : "error" }));
    return () => { cancelled = true; if (made) URL.revokeObjectURL(made); };
  }, [path, version]);
  return state;
}

const Pct = ({ v, present = true }: { v?: number; present?: boolean }) => {
  if (!present) return <span className="bank-conf conf-low">not read</span>;
  if (v === undefined) return <span className="bank-conf">-</span>;
  return <span className={`bank-conf ${v < LOW_CONFIDENCE ? "conf-low" : ""}`} title={v < LOW_CONFIDENCE ? `Below ${LOW_CONFIDENCE * 100}%: please check` : undefined}>{Math.round(v * 100)}%</span>;
};

function DocCard({ appId, kind, data }: { appId: string; kind: DocKind; data?: DocData }) {
  const img = useBlob(data ? `/files/${appId}/${kind}` : null, data?.uploadedAt);
  const f = data?.fields ?? {}, c = data?.confidence ?? {};
  const rows: { label: string; value: string | null | undefined; conf?: number }[] =
    kind === "aadhaar"
      ? [{ label: "Name", value: f.name, conf: c.name }, { label: "Date of birth", value: f.dob && f.dob.split("-").reverse().join("/"), conf: c.dob }, { label: "Aadhaar number", value: data?.aadhaarLast4 ? `XXXX XXXX ${data.aadhaarLast4}` : null, conf: c.number }]
      : kind === "pan"
      ? [{ label: "Name", value: f.name, conf: c.name }, { label: "Date of birth", value: f.dob && f.dob.split("-").reverse().join("/"), conf: c.dob }, { label: "PAN", value: f.pan, conf: c.number }]
      : [{ label: "Account holder", value: f.name, conf: c.name }, { label: "IFSC", value: f.ifsc, conf: c.ifsc }];

  return (
    <section className="bank-card bank-doc">
      <h3>
        {DOC_LABEL[kind]}
        {data && (
          <>
            {" "}
            <span className={`bank-chip ${data.valid ? "bank-chip--approved" : "bank-chip--needs_fix"}`}>{kind === "passbook" ? (data.valid ? "IFSC valid" : "IFSC invalid") : data.valid ? "Number valid" : "Number invalid"}</span>
            {data.blurry && <span className="bank-chip bank-chip--needs_fix">Blurry</span>}
          </>
        )}
      </h3>
      {!data && <p className="bank-empty">Not uploaded yet.</p>}
      {data && (
        <>
          <div className="bank-doc-image">
            {img.status === "loading" && <div className="bank-spinner" role="status" aria-label="Loading photo" />}
            {img.status === "ok" && img.url && <a href={img.url} target="_blank" rel="noreferrer"><img src={img.url} alt={`${DOC_LABEL[kind]} photo`} /></a>}
            {img.status === "missing" && <p className="bank-empty">No photo stored.</p>}
            {img.status === "error" && <p className="bank-notice bank-notice--warn">Could not load the photo.</p>}
          </div>
          <table className="bank-table">
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className={!r.value || (r.conf ?? 1) < LOW_CONFIDENCE ? "row-low" : ""}>
                  <th>{r.label}</th>
                  <td>{r.value || <em>not read</em>}</td>
                  <td className="num"><Pct v={r.conf} present={!!r.value} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}

export function BankDetail() {
  const { id = "" } = useParams();
  const [app, setApp] = useState<BankApp | null>(null);
  const [load, setLoad] = useState<Load>("loading");
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [pdf, setPdf] = useState<{ state: "idle" | "loading" | "ok" | "error" | "missing"; url?: string }>({ state: "idle" });
  const [mode, setMode] = useState<null | "approve" | "send_back">(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    setLoad("loading");
    const un1 = onSnapshot(
      doc(bankDb(), "applications", id),
      (s) => { if (s.exists()) { setApp({ id: s.id, ...(s.data() as object) } as BankApp); setLoad("ok"); } else setLoad("missing"); },
      () => setLoad("error"),
    );
    const un2 = onSnapshot(
      query(collection(bankDb(), "applications", id, "audit"), orderBy("at", "desc")),
      (s) => setAudit(s.docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as AuditEntry)),
      () => setAudit([]),
    );
    return () => { un1(); un2(); };
  }, [id]);

  useEffect(() => () => { if (pdf.url) URL.revokeObjectURL(pdf.url); }, [pdf.url]);

  const viewPdf = async () => {
    setPdf({ state: "loading" });
    try {
      setPdf({ state: "ok", url: URL.createObjectURL(await bankApi<Blob>(`/files/${id}/pdf`, { blob: true })) });
    } catch (e) {
      setPdf({ state: e instanceof ApiError && e.status === 404 ? "missing" : "error" });
    }
  };

  const decide = async () => {
    if (!mode) return;
    if (mode === "send_back" && note.trim().length < 3) return setActionError("Please write the reason in English (at least 3 characters).");
    setBusy(true);
    setActionError(null);
    try {
      await bankApi(`/applications/${id}/review`, { json: mode === "approve" ? { decision: "approve", note: note.trim() || undefined } : { decision: "send_back", note: note.trim() } });
      setDone(mode === "approve" ? "Approved. A QR code was issued and the customer has been notified (if they agreed to WhatsApp)." : "Sent back. The customer sees your note in their language, with a voice message.");
      setMode(null);
      setNote("");
    } catch (e) {
      setActionError(e instanceof ApiError ? (e.status === 409 ? "This application is no longer waiting for review (someone else may have decided)." : e.status === 403 ? "Your account is not allowed to do this." : e.status === 0 ? "Cannot reach the server. Check your connection and try again." : "Something went wrong. Please try again.") : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  if (load === "loading") return <div className="bank-spinner" role="status" aria-label="Loading" />;
  if (load === "missing" || !app) return <><Link to="/bank" className="bank-back">← Queue</Link><p className="bank-empty">Application not found.</p></>;
  if (load === "error") return <><Link to="/bank" className="bank-back">← Queue</Link><p className="bank-notice bank-notice--warn">Cannot read this application (check your connection and the Firestore rules).</p></>;

  const score = app.readiness?.score ?? 0;
  const canDecide = app.status === "ready_for_review";

  return (
    <div>
      <Link to="/bank" className="bank-back">← Queue</Link>

      <div className="bank-title-row">
        <div>
          <h1>{appName(app)}</h1>
          <p className="bank-muted">{shortId(app.id)} · language {app.language} · sent {fmt(app.metrics?.readyAt) || "not yet"} · WhatsApp {app.notify?.consent ? "on" : "off"}</p>
        </div>
        <div className="bank-title-flags">
          {app.readiness?.quickApprove && <span className="bank-badge-quick">✓ Quick approve</span>}
          <span className="bank-bigscore" title="Readiness">{score}<small>/100</small></span>
          <StatusChip status={app.status} />
        </div>
      </div>

      {done && <p className="bank-notice bank-notice--ok" role="status">{done}</p>}

      {/* Decision */}
      <section className="bank-card bank-decision">
        {canDecide ? (
          <>
            <h2>Decision</h2>
            {(app.mismatches ?? []).some((m) => m.severity === "block") && <p className="bank-notice bank-notice--warn">This application has blocking problems listed below. You can still decide, but check them first.</p>}
            {!mode && (
              <div className="bank-actions">
                <button type="button" className="bank-btn bank-btn--primary" onClick={() => { setMode("approve"); setActionError(null); }}>Approve</button>
                <button type="button" className="bank-btn bank-btn--amber" onClick={() => { setMode("send_back"); setActionError(null); }}>Send back</button>
              </div>
            )}
            {mode && (
              <div className="bank-form">
                <label>
                  {mode === "approve" ? "Note (optional, internal)" : "Reason for the customer (write in English; it is translated and read aloud in their language)"}
                  <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder={mode === "send_back" ? "e.g. Please retake the PAN card photo; the name is cut off." : ""} autoFocus />
                </label>
                {actionError && <p className="bank-notice bank-notice--warn" role="alert">{actionError}</p>}
                <div className="bank-actions">
                  <button type="button" className={`bank-btn ${mode === "approve" ? "bank-btn--primary" : "bank-btn--amber"}`} disabled={busy} onClick={() => void decide()}>
                    {busy ? "Working…" : mode === "approve" ? "Confirm approve" : "Confirm send back"}
                  </button>
                  <button type="button" className="bank-btn bank-btn--ghost" disabled={busy} onClick={() => { setMode(null); setActionError(null); }}>Cancel</button>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <h2>Decision</h2>
            <p>
              Status: <StatusChip status={app.status} />
              {app.review?.decision && <> · {app.review.decision === "approved" ? "Approved" : "Sent back"} {fmt(app.review.at)}</>}
            </p>
            {app.review?.note && <p className="bank-muted">Note: {app.review.note}{app.review.noteTranslated && app.review.noteTranslated !== app.review.note ? ` → ${app.review.noteTranslated}` : ""}</p>}
            {app.status === "docs_pending" || app.status === "needs_fix" ? <p className="bank-muted">Waiting for the customer to finish.</p> : null}
          </>
        )}
      </section>

      {/* Problems */}
      <section className="bank-card">
        <h2>Checks</h2>
        {(app.mismatches ?? []).length === 0 ? (
          <p className="bank-notice bank-notice--ok">No problems found by the automatic checks.</p>
        ) : (
          <ul className="bank-list">
            {app.mismatches!.map((m, i) => (
              <li key={i}>
                <span className={`bank-chip ${m.severity === "block" ? "bank-chip--needs_fix" : "bank-chip--warn"}`}>{m.severity === "block" ? "Blocking" : "Warning"}</span>{" "}
                <b>{m.code}</b>{m.doc ? ` (${DOC_LABEL[m.doc]})` : ""}: {m.message?.en}
                {m.detail && <span className="bank-muted"> [{Object.entries(m.detail).map(([k, v]) => `${k}: ${v}`).join(" · ")}]</span>}
              </li>
            ))}
          </ul>
        )}
        {app.readiness?.items && (
          <ul className="bank-checklist">
            {app.readiness.items.map((it) => (
              <li key={it.id} className={it.done ? "ok" : "todo"}>
                <span>{it.done ? "✓" : "•"}</span> {it.id} <small>{Math.round(it.points)}/{it.max}</small>{!it.done && it.todo?.en ? <em> {it.todo.en}</em> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* What the customer told us */}
      <section className="bank-card">
        <h2>Customer answers</h2>
        <table className="bank-table">
          <tbody>
            {Object.keys(FIELD_LABEL).map((fid) => {
              const a = app.answers?.[fid];
              return (
                <tr key={fid} className={a && (a.confidence ?? 1) < LOW_CONFIDENCE ? "row-low" : ""}>
                  <th>{FIELD_LABEL[fid]}</th>
                  <td>{a ? showAnswer(fid, a) : <em>not answered</em>}</td>
                  <td className="num">{a ? <Pct v={a.confidence} /> : null}</td>
                  <td className="num">{a?.confirmed ? "✓ confirmed" : ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* Documents */}
      <div className="bank-docs">
        {DOC_KINDS.map((k) => (
          <DocCard key={k} appId={app.id} kind={k} data={app.documents?.[k]} />
        ))}
      </div>

      {/* PDF */}
      <section className="bank-card">
        <h2>Application form (PDF)</h2>
        {pdf.state === "idle" && <button type="button" className="bank-btn bank-btn--ghost" onClick={() => void viewPdf()}>View PDF</button>}
        {pdf.state === "loading" && <div className="bank-spinner" role="status" aria-label="Loading PDF" />}
        {pdf.state === "missing" && <p className="bank-empty">No PDF yet (it is made when the customer sends the application).</p>}
        {pdf.state === "error" && <p className="bank-notice bank-notice--warn">Could not load the PDF. <button type="button" className="bank-link" onClick={() => void viewPdf()}>Try again</button></p>}
        {pdf.state === "ok" && pdf.url && (
          <>
            <p><a href={pdf.url} target="_blank" rel="noreferrer" className="bank-link">Open in a new tab</a></p>
            <iframe title="Application PDF" src={pdf.url} className="bank-pdf" />
          </>
        )}
      </section>

      {/* Audit */}
      <section className="bank-card">
        <h2>Audit trail</h2>
        {audit.length === 0 ? <p className="bank-empty">No entries.</p> : (
          <table className="bank-table bank-audit">
            <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Details</th></tr></thead>
            <tbody>
              {audit.map((a) => (
                <tr key={a.id}>
                  <td>{fmt(a.at)}</td>
                  <td>{a.actor === "system" ? "system" : String(a.actor ?? "").slice(0, 8)}</td>
                  <td>{a.action}</td>
                  <td className="bank-muted">{a.detail && Object.keys(a.detail).length ? JSON.stringify(a.detail) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

export default BankDetail;
