import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Icon } from "../Icons";
import { PrimaryButton, ProgressDots, WarningBanner, BottomHelpBar } from "../UIComponents";
import { useI18n, type Key } from "../../lib/i18n";
import { api, ApiError } from "../../lib/api";
import { errorKey } from "../../lib/errorText";
import { BLUR_THRESHOLD, isBlurry, laplacianVariance } from "../../lib/blur";
import { bitmapFromFile, bitmapFromVideo, openCamera, stopStream, toJpeg, type CameraFailure } from "../../lib/camera";
import { DOC_KINDS, useSession, type CheckResult, type DocKind, type Issue } from "../../lib/session";
import { speakServer } from "../../lib/speak";
import { useSpokenError } from "../../lib/spokenError";

interface ExtractResponse { kind: DocKind; valid: boolean; blurry: boolean; issues: Issue[]; blurScore: number; blurThreshold: number }
interface Shot { blob: Blob; url: string; blur: number | null; blurry: boolean }
type CamState = "starting" | "live" | CameraFailure;

const DOC_KEY: Record<DocKind, Key> = { aadhaar: "docAadhaar", pan: "docPan", passbook: "docPassbook" };
const CHIP_KEY: Record<DocKind, Key> = { aadhaar: "chipAadhaar", pan: "chipPan", passbook: "chipPassbook" };

function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  return online;
}

export function Screen4Camera({ onNext, onBack, onOpenHelp }: { onNext: () => void; onBack: () => void; onOpenHelp: () => void }) {
  const { t, lang } = useI18n();
  const session = useSession();
  const { appId, appLang, documents } = session;
  const location = useLocation();
  const online = useOnline();

  // Retake mode: arriving from the problems screen with { doc } re-does just that document.
  const single = (location.state as { doc?: DocKind } | null)?.doc ?? null;
  const debug = new URLSearchParams(location.search).get("debug") === "1";
  const msgLang = appLang ?? lang;

  const [kind, setKind] = useState<DocKind>(() => single ?? DOC_KINDS.find((k) => !documents[k]) ?? "aadhaar");
  const [cam, setCam] = useState<CamState>("starting");
  const [shot, setShot] = useState<Shot | null>(null);
  const [result, setResult] = useState<ExtractResponse | null>(null);
  const [busy, setBusy] = useState<null | "upload" | "check">(null);
  const [error, setError] = useState<{ text: string; retry?: () => void } | null>(null);
  const [okNote, setOkNote] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  useSpokenError(error?.text, msgLang);

  // Live camera while there is nothing to review.
  const wantLive = !shot && !result;
  useEffect(() => {
    if (!wantLive) return;
    let cancelled = false;
    setCam("starting");
    openCamera()
      .then((stream) => {
        if (cancelled) return stopStream(stream);
        streamRef.current = stream;
        const v = videoRef.current;
        if (v) { v.srcObject = stream; void v.play().catch(() => undefined); }
        setCam("live");
      })
      .catch((e: { reason?: CameraFailure }) => !cancelled && setCam(e.reason ?? "unavailable"));
    return () => { cancelled = true; stopStream(streamRef.current); streamRef.current = null; };
  }, [wantLive]);

  // Free the preview's object URL.
  useEffect(() => () => { if (shot) URL.revokeObjectURL(shot.url); }, [shot]);

  const fail = (e: unknown, retry?: () => void) => {
    const status = e instanceof ApiError ? e.status : 0;
    setError({ text: t(errorKey(e)), retry: status === -1 ? undefined : retry });
  };

  const acceptBitmap = async (bmp: ImageBitmap) => {
    const blur = laplacianVariance(bmp); // downscaled canvas check, on the phone
    const blob = await toJpeg(bmp);
    bmp.close();
    setShot({ blob, url: URL.createObjectURL(blob), blur, blurry: isBlurry(blur) });
  };

  const handleCapture = async () => {
    const v = videoRef.current;
    if (cam !== "live" || !v) return;
    setError(null); setOkNote(null);
    try { await acceptBitmap(await bitmapFromVideo(v)); } catch { setError({ text: t("genericError") }); }
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null); setOkNote(null);
    try {
      await acceptBitmap(await bitmapFromFile(file));
    } catch {
      // Format the browser cannot decode (e.g. HEIC on desktop): upload as is, skip the on-phone blur check.
      setShot({ blob: file, url: URL.createObjectURL(file), blur: null, blurry: false });
    }
  };

  const retake = () => { setShot(null); setResult(null); setError(null); setOkNote(null); };

  const finishAndCheck = useCallback(async () => {
    setBusy("check"); setError(null);
    try {
      const r = await api<CheckResult>(`/applications/${appId}/check`, { method: "POST", json: {} });
      session.setCheck(r);
      onNext();
    } catch (e) {
      fail(e, () => void finishAndCheck());
    } finally {
      setBusy(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appId, onNext]);

  /** Move to the next document that has no photo yet; after the last one, run the check. */
  const advance = (uploaded: DocKind) => {
    if (single) return void finishAndCheck();
    const have = new Set<DocKind>([...DOC_KINDS.filter((k) => documents[k]), uploaded]);
    const next = DOC_KINDS.find((k) => !have.has(k));
    if (!next) return void finishAndCheck();
    setKind(next); setShot(null); setResult(null);
  };

  const upload = async () => {
    if (!shot) return;
    setError(null);
    if (!navigator.onLine) return setError({ text: t("offline"), retry: () => void upload() });
    setBusy("upload");
    try {
      const fd = new FormData();
      fd.append("appId", appId!);
      fd.append("kind", kind);
      fd.append("image", shot.blob, "photo.jpg");
      const r = await api<ExtractResponse>("/documents/extract", { form: fd });
      session.setDocument(kind, { valid: r.valid, blurry: r.blurry, issues: r.issues });
      if (r.issues.length === 0) {
        setOkNote(t("docOk", { doc: t(CHIP_KEY[kind]) }));
        advance(kind);
      } else {
        setResult(r); // show what the server found; the person decides: retake or keep
        r.issues.forEach((i) => void speakServer(i.message[msgLang], msgLang));
      }
    } catch (e) {
      fail(e, () => void upload());
    } finally {
      setBusy(null);
    }
  };

  if (!appId) return <Navigate to="/" replace />;

  const idx = DOC_KINDS.indexOf(kind);
  const docName = t(DOC_KEY[kind]);
  const busyText = busy === "upload" ? t("uploading") : busy === "check" ? t("checkingAll") : null;
  const camMessage =
    cam === "starting" ? t("cameraStarting") : cam === "denied" ? t("camDenied") : cam === "live" ? null : t("camUnavailable");

  return (
    <div className="screen-container camera-screen-wrapper">
      <ProgressDots activeStep={1} />

      <div className="top-action-bar">
        <button type="button" onClick={onBack} className="nav-back-btn" aria-label={t("back")}>
          <Icon name="chevron" size={24} className="rotate-180" />
          <span>{t("back")}</span>
        </button>
      </div>

      <div className="page-heading-block">
        <span className="section-eyebrow">{t("docOf", { n: idx + 1 })}</span>
        <h1 className="screen-main-heading">{t("takePhoto", { doc: docName })}</h1>
      </div>

      {!online && <WarningBanner message={t("offline")} icon="alert" variant="amber" />}

      {/* Viewfinder: live rear camera, or the photo being reviewed */}
      <div className="camera-viewfinder-frame">
        <div className="viewfinder-corner corner-top-left" />
        <div className="viewfinder-corner corner-top-right" />
        <div className="viewfinder-corner corner-bottom-left" />
        <div className="viewfinder-corner corner-bottom-right" />

        {shot ? (
          <img className="camera-media" src={shot.url} alt={docName} />
        ) : (
          <video ref={videoRef} className="camera-media" playsInline muted autoPlay hidden={cam !== "live"} />
        )}
        {!shot && cam !== "live" && camMessage && <p className="camera-overlay-msg">{camMessage}</p>}
        {!shot && cam === "live" && <div className="camera-scan-laser-line" />}
        {busyText && (
          <div className="camera-busy-overlay" role="status">
            <span className="camera-spinner" aria-hidden="true" />
            <strong>{busyText}</strong>
          </div>
        )}
      </div>

      {!shot && !result && <p className="viewfinder-instruction-text">{t("placeCard")}</p>}

      {debug && shot && (
        <p className="blur-debug" role="note">
          blur {shot.blur === null ? "n/a" : shot.blur.toFixed(1)} (threshold {BLUR_THRESHOLD}, {shot.blur === null ? "not measured" : shot.blurry ? "BLURRY" : "sharp"})
          {result ? ` · server ${result.blurScore} (threshold ${result.blurThreshold})` : ""}
        </p>
      )}

      {/* Document checklist */}
      <div className="doc-checklist-chips">
        {DOC_KINDS.map((k) => {
          const d = documents[k];
          const done = !!d && d.issues.length === 0;
          return (
            <span key={k} className={`doc-chip ${done ? "chip-done" : "chip-pending"} ${k === kind ? "chip-current" : ""}`}>
              {done && <Icon name="check" size={16} />} {t(CHIP_KEY[k])}
            </span>
          );
        })}
      </div>

      {okNote && <WarningBanner message={okNote} icon="check" variant="green" />}
      {error && (
        <div className="api-error-box" role="alert">
          <WarningBanner message={error.text} icon="alert" variant="amber" />
          {error.retry && <button type="button" className="retry-link-btn" onClick={error.retry}>{t("tryAgain")}</button>}
        </div>
      )}

      {/* Server found a problem with the uploaded photo: retake or keep it (never a hard block) */}
      {result && (
        <div className="photo-issues">
          <strong className="photo-issues-title">{t("photoProblem")}</strong>
          {result.issues.map((i) => (
            <WarningBanner key={i.code} message={i.message[msgLang]} icon="alert" variant="amber" />
          ))}
          <div className="photo-actions-pair">
            <PrimaryButton onClick={retake} icon="camera" disabled={busy !== null}>{t("retake")}</PrimaryButton>
            <button type="button" className="secondary-btn secondary-btn--outline" onClick={() => advance(kind)} disabled={busy !== null}>
              <span className="btn-label">{t("keepContinue")}</span>
            </button>
          </div>
        </div>
      )}

      {/* Reviewing a captured photo */}
      {shot && !result && (
        <>
          {shot.blurry && (
            <div className="photo-issues">
              <WarningBanner message={`${t("blurryTitle")}. ${t("blurryBody")}`} icon="alert" variant="amber" />
            </div>
          )}
          <div className="photo-actions-pair">
            {shot.blurry ? (
              <>
                <PrimaryButton onClick={retake} icon="camera" disabled={busy !== null}>{t("retake")}</PrimaryButton>
                <button type="button" className="secondary-btn secondary-btn--outline" onClick={() => void upload()} disabled={busy !== null}>
                  <span className="btn-label">{t("useAnyway")}</span>
                </button>
              </>
            ) : (
              <>
                <PrimaryButton onClick={() => void upload()} disabled={busy !== null}>{t("useThis")}</PrimaryButton>
                <button type="button" className="secondary-btn secondary-btn--outline" onClick={retake} disabled={busy !== null}>
                  <span className="btn-label">{t("retake")}</span>
                </button>
              </>
            )}
          </div>
        </>
      )}

      {/* Live: shutter + choose-a-photo fallback */}
      {!shot && !result && (
        <>
          <div className="shutter-control-center">
            <button type="button" onClick={() => void handleCapture()} disabled={cam !== "live" || busy !== null} className="large-round-shutter-btn" aria-label={t("tapCapture")}>
              <div className="shutter-inner-ring">
                <Icon name="camera" size={32} />
              </div>
            </button>
            <span className="shutter-helper-label">{t("tapCapture")}</span>
          </div>
          <div className="screen-bottom-action">
            <button type="button" className="secondary-btn secondary-btn--outline" onClick={() => fileRef.current?.click()}>
              <Icon name="document" size={22} />
              <span className="btn-label">{t("chooseFile")}</span>
            </button>
          </div>
        </>
      )}
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { void handleFile(e.target.files?.[0]); e.target.value = ""; }} />

      <BottomHelpBar onHelpClick={onOpenHelp} label={t("help")} />
    </div>
  );
}

export default Screen4Camera;
