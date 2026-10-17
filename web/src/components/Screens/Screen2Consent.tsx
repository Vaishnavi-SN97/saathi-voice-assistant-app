import { useState } from "react";
import { Icon } from "../Icons";
import {
  PrimaryButton,
  ProgressDots,
  WarningBanner,
  BottomHelpBar,
} from "../UIComponents";
import { speakText } from "../../utils/speech";
import { LANG_CODE, useI18n } from "../../lib/i18n";
import { api, ApiError } from "../../lib/api";
import { toQuestion, useSession } from "../../lib/session";
import { useSpokenError } from "../../lib/spokenError";

interface CreateResponse {
  id: string;
  status: string;
  question: { id: string; type: string; text: string; audioUrl: string; options?: { value: string; label: string }[] };
}

export function Screen2Consent({
  onNext,
  onBack,
  onOpenHelp,
}: {
  onNext: () => void;
  onBack: () => void;
  onOpenHelp: () => void;
}) {
  const { lang, t } = useI18n();
  const session = useSession();
  const [showModal, setShowModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useSpokenError(error, lang);

  const consentPoints = [
    { icon: "mic" as const, text: t("c1") },
    { icon: "lock" as const, text: t("c2"), highlight: true },
    { icon: "shield" as const, text: t("c3") },
  ];

  const handleListenScreen = () => speakText(t("consentSpeech"), LANG_CODE[lang]);

  // "I agree" creates the application (draft + consent) and gets the first question.
  const handleAgree = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api<CreateResponse>("/applications", { json: { language: lang, consent: true } });
      session.start(r.id, lang, toQuestion(r.question));
      onNext();
    } catch (e) {
      const code = e instanceof ApiError ? e.status : 0;
      setError(code === -1 ? t("notConfigured") : code === 0 ? t("netError") : t("genericError"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="screen-container">
      {/* Top Progress indicator */}
      <ProgressDots activeStep={0} />

      {/* Top bar with back and listen button */}
      <div className="top-action-bar">
        <button type="button" onClick={onBack} className="nav-back-btn" aria-label={t("back")}>
          <Icon name="chevron" size={24} className="rotate-180" />
          <span>{t("back")}</span>
        </button>

        <button type="button" onClick={handleListenScreen} className="listen-pill-btn" aria-label={t("listenThis")}>
          <Icon name="speaker" size={22} />
          <span>{t("listenThis")}</span>
        </button>
      </div>

      {/* Screen Heading */}
      <div className="page-heading-block">
        <span className="section-eyebrow">{t("yourSafety")}</span>
        <h1 className="screen-main-heading">{t("beforeStart")}</h1>
      </div>

      {/* 3 Privacy Lines with friendly rounded icons */}
      <div className="consent-points-list">
        {consentPoints.map((item, index) => (
          <div key={index} className={`consent-point-card ${item.highlight ? "highlight-point" : ""}`}>
            <div className="consent-icon-circle">
              <Icon name={item.icon} size={26} />
            </div>
            <p className="consent-text">{item.text}</p>
          </div>
        ))}
      </div>

      {/* Teal shield badge */}
      <div className="teal-shield-badge">
        <div className="shield-icon-badge">
          <Icon name="shield" size={32} />
        </div>
        <div className="shield-badge-copy">
          <strong className="badge-title">{t("privTitle")}</strong>
          <span className="badge-subtitle">{t("privSub")}</span>
        </div>
      </div>

      {error && (
        <div className="api-error-box" role="alert">
          <WarningBanner message={error} icon="alert" variant="amber" />
          {error !== t("notConfigured") && (
            <button type="button" className="retry-link-btn" onClick={handleAgree}>
              {t("tryAgain")}
            </button>
          )}
        </div>
      )}

      {/* Actions: Primary button + secondary text button */}
      <div className="screen-bottom-action">
        <PrimaryButton onClick={handleAgree} disabled={busy}>
          {busy ? t("starting") : t("agree")}
        </PrimaryButton>

        <button type="button" onClick={() => setShowModal(true)} className="read-more-text-btn">
          {t("readMore")}
        </button>
      </div>

      {/* Bottom Help Link */}
      <BottomHelpBar onHelpClick={onOpenHelp} label={t("help")} />

      {/* Read More Modal */}
      {showModal && (
        <div className="app-modal-overlay" role="dialog" aria-modal="true">
          <div className="app-modal-card">
            <div className="modal-header">
              <div className="modal-icon-badge">
                <Icon name="shield" size={28} />
              </div>
              <h3 className="modal-title">{t("mTitle")}</h3>
            </div>
            <div className="modal-body-content">
              <p>{t("m1")}</p>
              <p>{t("m2")}</p>
              <p>{t("m3")}</p>
            </div>
            <button type="button" onClick={() => setShowModal(false)} className="modal-close-primary-btn">
              {t("understand")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Screen2Consent;
