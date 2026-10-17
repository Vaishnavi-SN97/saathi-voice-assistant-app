import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import QRCode from "qrcode";
import { Icon } from "../Icons";
import { PrimaryButton, SecondaryButton, ProgressDots, WarningBanner, BottomHelpBar } from "../UIComponents";
import { useI18n, type Key } from "../../lib/i18n";
import { BRANCH, fmtDateTime, shortId, useApplication, type LiveError } from "../../lib/application";
import { useOnline } from "../../lib/online";
import { useSession } from "../../lib/session";
import { speakServer } from "../../lib/speak";
import { useSpokenError } from "../../lib/spokenError";

const LIVE_ERROR: Record<LiveError, Key> = {
  not_configured: "notConfigured",
  permission: "livePermission",
  network: "liveNetwork",
  missing: "liveMissing",
};

export function Screen8QR({ onRestart, onBack, onOpenHelp }: { onRestart: () => void; onBack: () => void; onOpenHelp: () => void }) {
  const { t, lang } = useI18n();
  const { appId, appLang } = useSession();
  const msgLang = appLang ?? lang;
  const online = useOnline();
  const { app, error, loading, retry } = useApplication(appId);

  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  useSpokenError(error ? t(LIVE_ERROR[error]) : null, msgLang);

  // The real QR: the approved application's signed token, drawn in the browser.
  const token = app?.status === "approved" ? app.qr?.token : undefined;
  useEffect(() => {
    if (!token) return setQrUrl(null);
    let cancelled = false;
    QRCode.toDataURL(token, { width: 480, margin: 2, errorCorrectionLevel: "M", color: { dark: "#0b3f45", light: "#ffffff" } })
      .then((u) => !cancelled && setQrUrl(u))
      .catch(() => !cancelled && setQrUrl(null));
    return () => { cancelled = true; };
  }, [token]);

  if (!appId) return <Navigate to="/" replace />;

  const number = shortId(appId);
  const status = app?.status;

  const handleCopy = () => {
    void navigator.clipboard?.writeText(number);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSave = () => {
    if (!qrUrl) return;
    const a = document.createElement("a");
    a.href = qrUrl;
    a.download = `saathi-${number}.png`;
    a.click();
    setSaved(true);
  };

  return (
    <div className="screen-container qr-screen-wrapper">
      <ProgressDots activeStep={3} />

      <div className="top-action-bar">
        <button type="button" onClick={onBack} className="nav-back-btn" aria-label={t("back")}>
          <Icon name="chevron" size={24} className="rotate-180" />
          <span>{t("back")}</span>
        </button>

        <button type="button" onClick={() => void speakServer(t("qrSpeech"), msgLang)} className="listen-pill-btn" aria-label={t("listen")}>
          <Icon name="speaker" size={22} />
          <span>{t("listen")}</span>
        </button>
      </div>

      <div className="page-heading-block">
        <span className="section-eyebrow">{t("qrEyebrow")}</span>
        <h1 className="screen-main-heading">{status && status !== "approved" ? (status === "signed" ? t("headSigned") : t("qrWaitTitle")) : t("qrTitle")}</h1>
      </div>

      {!online && <WarningBanner message={t("offline")} icon="alert" variant="amber" />}
      {error && (
        <div className="api-error-box" role="alert">
          <WarningBanner message={t(LIVE_ERROR[error])} icon="alert" variant="amber" />
          {error !== "not_configured" && error !== "missing" && (
            <button type="button" className="retry-link-btn" onClick={retry}>{t("tryAgain")}</button>
          )}
        </div>
      )}
      {loading && !error && (
        <div className="screen-loading" role="status">
          <span className="camera-spinner dark" aria-hidden="true" />
        </div>
      )}

      {/* Waiting / used states */}
      {app && status !== "approved" && (
        <div className="qr-not-ready" aria-live="polite">
          <Icon name={status === "signed" ? "check" : "lock"} size={40} />
          <p>{status === "signed" ? t("qrUsed") : t("qrWaitBody")}</p>
        </div>
      )}

      {/* The real QR for the approved application */}
      {app && status === "approved" && (
        <div className="huge-qr-card-container">
          <div className="qr-svg-holder">
            {qrUrl ? (
              <img className="qr-matrix-svg" src={qrUrl} alt={`QR ${number}`} width={240} height={240} />
            ) : (
              <span className="camera-spinner dark" aria-hidden="true" />
            )}
          </div>

          <div className="application-number-strip">
            <span className="app-id-label">{t("appNumber")}</span>
            <div className="app-id-row">
              <strong className="app-id-text">{number}</strong>
              <button type="button" onClick={handleCopy} className="copy-chip-btn" aria-label={t("copy")}>
                <Icon name={copied ? "check" : "copy"} size={16} />
                <span>{copied ? t("copied") : t("copy")}</span>
              </button>
            </div>
            {app.qr?.expiresAt && <span className="qr-valid-until">{t("validUntil", { date: fmtDateTime(app.qr.expiresAt, lang) })}</span>}
          </div>

          <div className="fast-queue-badge">
            <Icon name="check" size={20} />
            <strong>{t("noQueue")}</strong>
          </div>
        </div>
      )}

      {/* What to carry */}
      <div className="what-to-carry-card">
        <h3 className="carry-title">{t("carryTitle")}</h3>
        <div className="carry-items-list">
          {(["carryAadhaar", "carryPan", "carryPassbook"] as const).map((k) => (
            <div className="carry-row" key={k}>
              <div className="carry-icon-box">
                <Icon name="document" size={20} />
              </div>
              <span className="carry-text">{t(k)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="screen-bottom-action">
        {status === "approved" && (
          <PrimaryButton onClick={handleSave} icon={saved ? "check" : "arrow"} disabled={!qrUrl}>
            {saved ? t("saved") : t("saveQr")}
          </PrimaryButton>
        )}

        <a href={`tel:${BRANCH.phoneTel}`} className="qr-call-link">
          <SecondaryButton icon="phone" variant="outline" className="mt-3">
            {t("callBranch", { phone: BRANCH.phoneDisplay })}
          </SecondaryButton>
        </a>

        <button type="button" onClick={onRestart} className="restart-flow-text-btn">
          {t("restart")}
        </button>
      </div>

      <BottomHelpBar onHelpClick={onOpenHelp} label={t("help")} />
    </div>
  );
}

export default Screen8QR;
