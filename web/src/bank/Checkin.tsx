import { useCallback, useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import SignaturePad from "signature_pad";
import { ApiError } from "../lib/api";
import { PdfViewer } from "./PdfViewer";
import { bankApi, fmt } from "./types";

interface Verified {
  appId: string;
  status: string;
  expiresAt?: string;
  summary: {
    name?: string; dob?: string; mobile?: string; address?: string; occupation?: string;
    nomineeName?: string; nomineeRelation?: string; aadhaarLast4?: string | null; readinessScore?: number | null;
  };
}
interface Signed { status: string; signedAt: string }

const ERRORS: Record<string, string> = {
  qr_used: "This QR code was already used. The application has been signed before.",
  qr_expired: "This QR code has expired (they last 3 days). Ask the customer to contact the bank.",
  qr_invalid: "This QR code is not valid. Check that you scanned the Saathi QR code.",
  wrong_status: "This application is not in the approved state.",
  forbidden: "Your account is not allowed to check customers in.",
};
const explain = (e: unknown) =>
  e instanceof ApiError ? (ERRORS[e.code] ?? (e.status === 0 ? "Cannot reach the server. Check the connection and try again." : "Something went wrong. Please try again.")) : "Something went wrong. Please try again.";

/** Camera QR scanner (html5-qrcode). Falls back to the paste box when the camera is blocked or missing. */
function Scanner({ onToken }: { onToken: (t: string) => void }) {
  const [state, setState] = useState<"starting" | "running" | "denied" | "unavailable">("starting");
  const handled = useRef(false);
  useEffect(() => {
    handled.current = false;
    const scanner = new Html5Qrcode("bank-qr-reader", { verbose: false });
    let started = false, disposed = false;
    scanner
      .start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 240, height: 240 } }, (text) => {
        if (handled.current) return;
        handled.current = true;
        onToken(text);
      }, () => undefined)
      .then(() => { started = true; if (disposed) void scanner.stop().then(() => scanner.clear()).catch(() => undefined); else setState("running"); })
      .catch((e: unknown) => !disposed && setState(/permission|denied|notallowed/i.test(String(e)) ? "denied" : "unavailable"));
    return () => {
      disposed = true;
      if (started) void scanner.stop().then(() => scanner.clear()).catch(() => undefined);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div>
      <div id="bank-qr-reader" className="bank-scanner" />
      {state === "starting" && <p className="bank-muted">Starting the camera…</p>}
      {state === "denied" && <p className="bank-notice bank-notice--warn">The camera is blocked. Allow it in the browser, or paste the code below.</p>}
      {state === "unavailable" && <p className="bank-notice bank-notice--warn">No camera available (a camera needs https or localhost). Paste the code below.</p>}
    </div>
  );
}

/** Finger / mouse signature on a canvas (signature_pad). */
function SignatureBox({ padRef, onChange }: { padRef: React.MutableRefObject<SignaturePad | null>; onChange: (empty: boolean) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = canvas.current!;
    const pad = new SignaturePad(el, { penColor: "#102a43", backgroundColor: "rgba(255,255,255,0)" });
    padRef.current = pad;
    const resize = () => {
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      el.width = el.offsetWidth * ratio;
      el.height = el.offsetHeight * ratio;
      el.getContext("2d")!.scale(ratio, ratio);
      pad.clear();
      onChange(true);
    };
    resize();
    window.addEventListener("resize", resize);
    pad.addEventListener("endStroke", () => onChange(pad.isEmpty()));
    return () => { window.removeEventListener("resize", resize); pad.off(); padRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <canvas ref={canvas} className="bank-signature" aria-label="Signature area" />;
}

export function BankCheckin() {
  const [paste, setPaste] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [verified, setVerified] = useState<Verified | null>(null);
  const [signed, setSigned] = useState<Signed | null>(null);
  const [busy, setBusy] = useState<null | "verify" | "sign">(null);
  const [error, setError] = useState<string | null>(null);
  const [empty, setEmpty] = useState(true);
  const [scanKey, setScanKey] = useState(0);
  const pad = useRef<SignaturePad | null>(null);

  const verify = useCallback(async (raw: string) => {
    const t = raw.trim();
    if (t.length < 20) return setError("That does not look like a Saathi QR code.");
    setBusy("verify");
    setError(null);
    try {
      setVerified(await bankApi<Verified>("/checkin/verify", { json: { token: t } }));
      setToken(t);
    } catch (e) {
      setError(explain(e));
      setScanKey((k) => k + 1); // let the scanner try again
    } finally {
      setBusy(null);
    }
  }, []);

  const complete = async () => {
    if (!verified || !token || !pad.current || pad.current.isEmpty()) return;
    setBusy("sign");
    setError(null);
    try {
      setSigned(await bankApi<Signed>(`/applications/${verified.appId}/sign`, { json: { token, signature: pad.current.toDataURL("image/png") } }));
    } catch (e) {
      setError(explain(e));
    } finally {
      setBusy(null);
    }
  };

  const reset = () => { setToken(null); setVerified(null); setSigned(null); setPaste(""); setError(null); setEmpty(true); setScanKey((k) => k + 1); };

  useEffect(() => { if (!verified) setEmpty(true); }, [verified]);

  const s = verified?.summary;
  return (
    <div>
      <h1>Check in a customer</h1>
      <p className="bank-muted">Scan the QR code on the customer's phone, then check their original documents against the summary and let them sign.</p>

      {error && <p className="bank-notice bank-notice--warn" role="alert">{error}</p>}

      {!verified && (
        <div className="bank-checkin-grid">
          <section className="bank-card">
            <h2>Scan the QR code</h2>
            {busy === "verify" ? <div className="bank-spinner" role="status" aria-label="Checking" /> : <Scanner key={scanKey} onToken={(t) => void verify(t)} />}
          </section>
          <section className="bank-card">
            <h2>Or paste the code</h2>
            <form className="bank-form" onSubmit={(e) => { e.preventDefault(); void verify(paste); }}>
              <label>
                Code from the QR (long text starting with “eyJ”)
                <textarea rows={4} value={paste} onChange={(e) => setPaste(e.target.value)} spellCheck={false} placeholder="Paste here" />
              </label>
              <button type="submit" className="bank-btn bank-btn--primary" disabled={busy !== null || paste.trim().length < 20}>{busy === "verify" ? "Checking…" : "Verify"}</button>
            </form>
          </section>
        </div>
      )}

      {verified && !signed && s && (
        <div className="bank-checkin-grid">
          <section className="bank-card">
            <h2>Customer summary <span className="bank-chip bank-chip--approved">Approved</span></h2>
            <table className="bank-table">
              <tbody>
                <tr><th>Name</th><td>{s.name}</td></tr>
                <tr><th>Date of birth</th><td>{s.dob ? s.dob.split("-").reverse().join("/") : ""}</td></tr>
                <tr><th>Mobile</th><td>{s.mobile}</td></tr>
                <tr><th>Address</th><td>{s.address}</td></tr>
                <tr><th>Occupation</th><td>{s.occupation}</td></tr>
                <tr><th>Nominee</th><td>{s.nomineeName} ({s.nomineeRelation})</td></tr>
                <tr><th>Aadhaar</th><td>{s.aadhaarLast4 ? `XXXX XXXX ${s.aadhaarLast4}` : "-"}</td></tr>
                <tr><th>Readiness</th><td>{s.readinessScore ?? "-"}/100</td></tr>
                <tr><th>QR valid until</th><td>{fmt(verified.expiresAt)}</td></tr>
              </tbody>
            </table>
            <PdfViewer appId={verified.appId} label="View application PDF" />
          </section>

          <section className="bank-card">
            <h2>Customer signature</h2>
            <p className="bank-muted">Ask the customer to sign inside the box. Check their original Aadhaar, PAN and passbook first.</p>
            <SignatureBox padRef={pad} onChange={setEmpty} />
            <div className="bank-actions">
              <button type="button" className="bank-btn bank-btn--ghost" disabled={busy !== null} onClick={() => { pad.current?.clear(); setEmpty(true); }}>Clear</button>
              <button type="button" className="bank-btn bank-btn--primary" disabled={busy !== null || empty} onClick={() => void complete()}>{busy === "sign" ? "Saving…" : "Complete"}</button>
              <button type="button" className="bank-btn bank-btn--ghost" disabled={busy !== null} onClick={reset}>Cancel</button>
            </div>
          </section>
        </div>
      )}

      {signed && verified && (
        <section className="bank-card">
          <p className="bank-notice bank-notice--ok" role="status">Signed ✓ at {fmt(signed.signedAt)}. The QR code can no longer be used, and the customer has been notified (if they agreed to WhatsApp).</p>
          <PdfViewer appId={verified.appId} label="View signed PDF" reloadKey={signed.signedAt} />
          <div className="bank-actions" style={{ marginTop: 16 }}>
            <button type="button" className="bank-btn bank-btn--primary" onClick={reset}>Check in another customer</button>
          </div>
        </section>
      )}
    </div>
  );
}

export default BankCheckin;
