import { useEffect, useState } from "react";
import { ApiError } from "../lib/api";
import { bankApi } from "./types";

/** Loads the application PDF with the banker's token and shows it inline (blob URL, revoked on leave). */
export function PdfViewer({ appId, label = "View PDF", reloadKey }: { appId: string; label?: string; reloadKey?: string }) {
  const [state, setState] = useState<{ s: "idle" | "loading" | "ok" | "error" | "missing"; url?: string }>({ s: "idle" });

  useEffect(() => () => { if (state.url) URL.revokeObjectURL(state.url); }, [state.url]);
  useEffect(() => { setState({ s: "idle" }); }, [appId, reloadKey]);

  const load = async () => {
    setState({ s: "loading" });
    try {
      setState({ s: "ok", url: URL.createObjectURL(await bankApi<Blob>(`/files/${appId}/pdf`, { blob: true })) });
    } catch (e) {
      setState({ s: e instanceof ApiError && e.status === 404 ? "missing" : "error" });
    }
  };

  return (
    <div>
      {state.s === "idle" && <button type="button" className="bank-btn bank-btn--ghost" onClick={() => void load()}>{label}</button>}
      {state.s === "loading" && <div className="bank-spinner" role="status" aria-label="Loading PDF" />}
      {state.s === "missing" && <p className="bank-empty">No PDF yet.</p>}
      {state.s === "error" && <p className="bank-notice bank-notice--warn">Could not load the PDF. <button type="button" className="bank-link" onClick={() => void load()}>Try again</button></p>}
      {state.s === "ok" && state.url && (
        <>
          <p><a href={state.url} target="_blank" rel="noreferrer" className="bank-link">Open in a new tab</a></p>
          <iframe title="Application PDF" src={state.url} className="bank-pdf" />
        </>
      )}
    </div>
  );
}
