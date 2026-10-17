import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Icon } from "../Icons";
import { PrimaryButton, ProgressDots, WarningBanner, BottomHelpBar } from "../UIComponents";
import { useI18n, type Key } from "../../lib/i18n";
import { api, ApiError } from "../../lib/api";
import { BRANCH, fmtDateTime, useApplication, type LiveApplication, type LiveError } from "../../lib/application";
import { useOnline } from "../../lib/online";
import { useSession } from "../../lib/session";
import { speakServer } from "../../lib/speak";

type StepState = "done" | "current" | "future" | "attention";
interface Step { title: Key; time: string; state: StepState }

const LIVE_ERROR: Record<LiveError, Key> = {
  not_configured: "notConfigured",
  permission: "livePermission",
  network: "liveNetwork",
  missing: "liveMissing",
};

/** Maps the application status to the 5 timeline steps (the status screen is driven only by Firestore). */
function buildSteps(app: LiveApplication, t: (k: Key) => string, when: (iso?: string) => string): Step[] {
  const m = app.metrics ?? {};
  const s = (title: Key, time: string, state: StepState): Step => ({ title, time, state });
  switch (app.status) {
    case "ready_for_review":
      return [s("step1", when(m.readyAt), "done"), s("step2", when(m.readyAt), "done"), s("step3", t("stepProgress"), "current"), s("step4", t("stepNext"), "future"), s("step5", t("stepFinal"), "future")];
    case "sent_back":
      return [s("step1", when(m.readyAt), "done"), s("step2", when(m.readyAt), "done"), s("step3", t("stepNeedsChange"), "attention"), s("step4", t("stepNext"), "future"), s("step5", t("stepFinal"), "future")];
    case "approved":
      return [s("step1", when(m.readyAt), "done"), s("step2", when(m.readyAt), "done"), s("step3", when(m.approvedAt), "done"), s("step4", when(m.approvedAt), "done"), s("step5", t("stepProgress"), "current")];
    case "signed":
      return [s("step1", when(m.readyAt), "done"), s("step2", when(m.readyAt), "done"), s("step3", when(m.approvedAt), "done"), s("step4", when(m.approvedAt), "done"), s("step5", when(m.signedAt), "done")];
    default: // draft / docs_pending / needs_fix: nothing sent yet
      return [s("step1", t("stepNotYet"), "current"), s("step2", t("stepNext"), "future"), s("step3", t("stepNext"), "future"), s("step4", t("stepNext"), "future"), s("step5", t("stepFinal"), "future")];
  }
}

export function Screen7Status({ onNext, onBack, onOpenHelp }: { onNext: () => void; onBack: () => void; onOpenHelp: () => void; isHindi?: boolean }) {
  const { t, lang } = useI18n();
  const session = useSession();
  const navigate = useNavigate();
  const online = useOnline();
  const { appId, appLang } = session;
  const msgLang = appLang ?? lang;
  const { app, error, loading, retry } = useApplication(appId);

  const [togglePending, setTogglePending] = useState<boolean | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);

  if (!appId) return <Navigate to="/" replace />;

  const when = (iso?: string) => (iso ? fmtDateTime(iso, lang) : "");
  const status = app?.status;
  const consent = togglePending ?? app?.notify?.consent === true;
  const note = app?.review?.noteTranslated ?? app?.review?.note ?? "";

  const hero: { tag: Key; head: Key; inst: string; icon: "shield" | "alert" | "check" } =
    status === "approved" ? { tag: "tagGood", head: "headApproved", inst: t("instApproved"), icon: "shield" }
    : status === "signed" ? { tag: "tagDone", head: "headSigned", inst: t("instSigned"), icon: "check" }
    : status === "sent_back" ? { tag: "tagChange", head: "headChange", inst: note, icon: "alert" }
    : status === "ready_for_review" ? { tag: "tagInReview", head: "headInReview", inst: t("instInReview"), icon: "shield" }
    : { tag: "tagNotSent", head: "headNotSent", inst: t("instNotSent"), icon: "alert" };

  const steps = app ? buildSteps(app, t, when) : [];

  const handleListen = () => void speakServer([t(hero.head), hero.inst].filter(Boolean).join(". "), msgLang);

  const toggleConsent = async () => {
    const next = !consent;
    setTogglePending(next);
    setToggleError(null);
    try {
      await api(`/applications/${appId}/notify-consent`, { json: { consent: next } });
    } catch (e) {
      setToggleError(e instanceof ApiError && e.status === 0 ? t("netError") : t("genericError"));
    } finally {
      setTogglePending(null); // from here the live snapshot is the truth
    }
  };

  const primary =
    status === "approved" ? { label: t("viewQr"), go: onNext }
    : status === "signed" ? { label: t("finish"), go: () => navigate("/done") }
    : status === "sent_back" ? { label: t("sendAgain"), go: () => navigate("/problems") }
    : status && status !== "ready_for_review" ? { label: t("goReadiness"), go: () => navigate("/readiness") }
    : null;

  return (
    <div className="screen-container status-screen-wrapper">
      <ProgressDots activeStep={status === "signed" ? 3 : 2} />

      <div className="top-action-bar">
        <button type="button" onClick={onBack} className="nav-back-btn" aria-label={t("back")}>
          <Icon name="chevron" size={24} className="rotate-180" />
          <span>{t("back")}</span>
        </button>

        <button type="button" onClick={handleListen} className="listen-pill-btn" aria-label={t("listen")} disabled={!app}>
          <Icon name="speaker" size={22} />
          <span>{t("listen")}</span>
        </button>
      </div>

      <div className="page-heading-block">
        <span className="section-eyebrow">{t("appNo", { id: appId.slice(0, 6).toUpperCase() })}</span>
        <h1 className="screen-main-heading">{t("statusHeading")}</h1>
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

      {app && (
        <>
          {/* Headline card for the current status, updated live */}
          <div className={`prominent-preapproved-card ${status === "sent_back" ? "card-attention" : ""}`} aria-live="polite">
            <div className="preapproved-header">
              <div className="preapproved-seal-icon">
                <Icon name={hero.icon} size={28} />
              </div>
              <div className="preapproved-titles">
                <span className="preapproved-tag">{t(hero.tag)}</span>
                <strong className="preapproved-headline">{t(hero.head)}</strong>
              </div>
            </div>

            {hero.inst && <p className="preapproved-instruction">{hero.inst}</p>}

            <div className="branch-location-strip">
              <div className="pin-circle">
                <Icon name="location" size={22} />
              </div>
              <div className="branch-name-info">
                <span className="branch-label">{t("assignedBranch")}</span>
                <strong className="branch-title-text">{BRANCH.name}</strong>
              </div>
            </div>
          </div>

          {/* Vertical timeline */}
          <div className="vertical-timeline-card">
            <div className="timeline-items-flow">
              {steps.map((step, index) => {
                const isDone = step.state === "done";
                const active = step.state === "current" || step.state === "attention";
                return (
                  <div key={step.title} className={`timeline-step-row ${isDone ? "step-finished" : active ? "step-active" : "step-pending"} ${step.state === "attention" ? "step-attention" : ""}`}>
                    {index < steps.length - 1 && <div className={`timeline-vertical-wire ${isDone ? "wire-filled" : ""}`} />}
                    <div className="timeline-node-marker">
                      {isDone ? <Icon name="check" size={14} /> : step.state === "attention" ? <Icon name="alert" size={14} /> : step.state === "current" ? <span className="current-pulse-dot" /> : <span className="future-empty-dot" />}
                    </div>
                    <div className="timeline-node-content">
                      <strong className="timeline-node-title">{t(step.title)}</strong>
                      <span className="timeline-node-time">{step.time}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* WhatsApp consent toggle (live from the application) */}
          <div className="whatsapp-notice-strip">
            <div className="whatsapp-icon-circle">
              <Icon name="whatsapp" size={22} />
            </div>
            <p className="whatsapp-text">{consent ? t("whatsappOn") : t("whatsappOff")}</p>
          </div>

          <div className="family-share-card">
            <div className="family-info-group">
              <div className="family-icon-box">
                <Icon name="whatsapp" size={22} />
              </div>
              <div className="family-copy">
                <strong>{t("notifyToggleTitle")}</strong>
                <span>{t("notifyToggleSub")}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void toggleConsent()}
              className={`family-toggle-switch ${consent ? "active" : ""}`}
              role="switch"
              aria-checked={consent}
              aria-label={t("notifyToggleTitle")}
              disabled={togglePending !== null || status === "draft"}
            >
              <span className="toggle-slider-knob" />
            </button>
          </div>
          {toggleError && <WarningBanner message={toggleError} icon="alert" variant="amber" />}

          {primary && (
            <div className="screen-bottom-action">
              <PrimaryButton onClick={primary.go}>{primary.label}</PrimaryButton>
            </div>
          )}
        </>
      )}

      <BottomHelpBar onHelpClick={onOpenHelp} label={t("help")} />
    </div>
  );
}

export default Screen7Status;
