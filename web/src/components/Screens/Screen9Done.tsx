import { Navigate } from "react-router-dom";
import { Icon } from "../Icons";
import { PrimaryButton, ProgressDots, BottomHelpBar } from "../UIComponents";
import { useI18n } from "../../lib/i18n";
import { shortId, useApplication } from "../../lib/application";
import { useSession } from "../../lib/session";
import { speakServer } from "../../lib/speak";

/** Final screen once the bank has signed the application (reached from the status screen). */
export function Screen9Done({ onRestart, onOpenHelp }: { onRestart: () => void; onOpenHelp: () => void }) {
  const { t, lang } = useI18n();
  const { appId, appLang } = useSession();
  const { app } = useApplication(appId);

  if (!appId) return <Navigate to="/" replace />;
  if (app && app.status !== "signed") return <Navigate to="/status" replace />;

  return (
    <div className="screen-container done-screen-wrapper">
      <ProgressDots activeStep={3} />

      <div className="done-hero">
        <div className="done-check-circle">
          <Icon name="check" size={56} />
        </div>
        <span className="section-eyebrow">{t("doneEyebrow")}</span>
        <h1 className="screen-main-heading">{t("doneTitle")}</h1>
        <p className="screen-sub-description">{t("doneBody")}</p>
        <strong className="app-id-text">{shortId(appId)}</strong>
        <button type="button" className="listen-pill-btn" onClick={() => void speakServer(`${t("doneTitle")}. ${t("doneBody")}`, appLang ?? lang)}>
          <Icon name="speaker" size={22} />
          <span>{t("listen")}</span>
        </button>
      </div>

      <div className="screen-bottom-action">
        <PrimaryButton onClick={onRestart}>{t("doneRestart")}</PrimaryButton>
      </div>

      <BottomHelpBar onHelpClick={onOpenHelp} label={t("help")} />
    </div>
  );
}

export default Screen9Done;
