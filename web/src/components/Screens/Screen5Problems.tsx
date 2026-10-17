import { useCallback, useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Icon } from "../Icons";
import { PrimaryButton, ProgressDots, WarningBanner, BottomHelpBar } from "../UIComponents";
import { useI18n, type Key } from "../../lib/i18n";
import { api } from "../../lib/api";
import { errorKey } from "../../lib/errorText";
import { useSession, type CheckResult, type DocKind, type Issue } from "../../lib/session";
import { speakServer } from "../../lib/speak";
import { useSpokenError } from "../../lib/spokenError";

const CHIP_KEY: Record<DocKind, Key> = { aadhaar: "chipAadhaar", pan: "chipPan", passbook: "chipPassbook" };
const TITLE_KEY = (code: string) => `p_${code}` as Key;
const fmtDate = (iso?: string) => (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split("-").reverse().join("/") : iso ?? "");

export function Screen5Problems({ onNext, onBack, onOpenHelp }: { onNext: () => void; onBack: () => void; onOpenHelp: () => void }) {
  const { t, lang } = useI18n();
  const session = useSession();
  const navigate = useNavigate();
  const { appId, appLang, check } = session;
  const msgLang = appLang ?? lang;

  const [loading, setLoading] = useState(!check);
  const [resolving, setResolving] = useState<string | null>(null);
  const [error, setError] = useState<{ text: string; retry: () => void } | null>(null);
  useSpokenError(error?.text, msgLang);

  const fail = (e: unknown, retry: () => void) => {
    setError({ text: t(errorKey(e)), retry });
  };

  // Always refresh: the server is the source of truth for what is still wrong.
  const load = useCallback(async () => {
    setError(null);
    try {
      session.setCheck(await api<CheckResult>(`/applications/${appId}/check`, { method: "POST", json: {} }));
    } catch (e) {
      fail(e, () => void load());
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appId]);
  useEffect(() => { if (appId) void load(); }, [appId, load]);

  const resolveName = async (use: "answers" | DocKind) => {
    setResolving(use);
    setError(null);
    try {
      session.setCheck(await api<CheckResult>(`/applications/${appId}/resolve-name`, { json: { use } }));
    } catch (e) {
      fail(e, () => void resolveName(use));
    } finally {
      setResolving(null);
    }
  };

  const retake = (doc: DocKind) => navigate("/camera", { state: { doc } });

  if (!appId) return <Navigate to="/" replace />;

  const issues = check?.mismatches ?? [];
  const docLabel = (d?: DocKind) => (d ? t(CHIP_KEY[d]) : "");

  const renderAction = (i: Issue) => {
    const doc = i.doc;
    if (i.code === "NAME_SPELLED_DIFFERENTLY" && doc) {
      const told = i.detail?.answerName ?? "", onDoc = i.detail?.docName ?? "";
      return (
        <>
          <div className="mini-docs-side-by-side">
            <div className="mini-doc-item aadhaar-mini">
              <div className="mini-doc-tag">{t("toldMe")}</div>
              <div className="mini-doc-name-preview">{told}</div>
            </div>
            <div className="mini-doc-item pan-mini">
              <div className="mini-doc-tag">{docLabel(doc)}</div>
              <div className="mini-doc-name-preview">{onDoc}</div>
            </div>
          </div>
          <div className="issue-action-box">
            <p className="issue-which">{t("whichCorrect")}</p>
            <button type="button" className="issue-selector-button" disabled={resolving !== null} onClick={() => void resolveName("answers")}>
              <Icon name="check" size={18} />
              <span className="selector-text">{resolving === "answers" ? t("resolving") : t("useSpellingTold", { name: told })}</span>
            </button>
            <button type="button" className="issue-selector-button" disabled={resolving !== null} onClick={() => void resolveName(doc)}>
              <Icon name="check" size={18} />
              <span className="selector-text">{resolving === doc ? t("resolving") : t("useSpellingDoc", { name: onDoc, doc: docLabel(doc) })}</span>
            </button>
          </div>
        </>
      );
    }
    if (!doc) return null;
    const detail =
      i.code === "DOB_MISMATCH" && i.detail ? (
        <p className="issue-description-copy">
          {fmtDate(i.detail.answerDob)} ≠ {fmtDate(i.detail.docDob)}
        </p>
      ) : null;
    return (
      <>
        {detail}
        <div className="issue-action-box">
          <button type="button" className="issue-selector-button" onClick={() => retake(doc)}>
            <Icon name="camera" size={20} />
            <span className="selector-text">{t(i.code === "DOC_MISSING" ? "addDoc" : "retakeDoc", { doc: docLabel(doc) })}</span>
          </button>
        </div>
      </>
    );
  };

  return (
    <div className="screen-container problems-screen-wrapper">
      <ProgressDots activeStep={1} />

      <div className="top-action-bar">
        <button type="button" onClick={onBack} className="nav-back-btn" aria-label={t("back")}>
          <Icon name="chevron" size={24} className="rotate-180" />
          <span>{t("back")}</span>
        </button>
        <div className="calm-chip-indicator">
          <span>{t("almostReady")}</span>
        </div>
      </div>

      <div className="page-heading-block">
        <span className="section-eyebrow">{t("quickCheck")}</span>
        <h1 className="screen-main-heading">
          {loading ? t("checkingAll") : issues.length === 0 ? t("allGood") : issues.length === 1 ? t("fixOne") : t("fixMany", { n: issues.length })}
        </h1>
      </div>

      {loading && (
        <div className="screen-loading" role="status">
          <span className="camera-spinner dark" aria-hidden="true" />
        </div>
      )}
      {error && (
        <div className="api-error-box" role="alert">
          <WarningBanner message={error.text} icon="alert" variant="amber" />
          <button type="button" className="retry-link-btn" onClick={error.retry}>{t("tryAgain")}</button>
        </div>
      )}

      <div className="issues-cards-container">
        {issues.map((i) => (
          <div key={`${i.code}:${i.doc ?? ""}`} className="issue-card-amber-border">
            <div className="issue-card-header">
              <div className="issue-title-group">
                <span className="issue-amber-dot">!</span>
                <h2 className="issue-card-title">{t(TITLE_KEY(i.code))}</h2>
              </div>
              <button
                type="button"
                onClick={() => void speakServer(`${t(TITLE_KEY(i.code))}. ${i.message[msgLang]}`, msgLang)}
                className="mini-speaker-btn"
                aria-label={t("readAloud")}
              >
                <Icon name="speaker" size={22} />
              </button>
            </div>
            <p className="issue-description-copy">{i.message[msgLang]}</p>
            {renderAction(i)}
          </div>
        ))}
      </div>

      {!loading && issues.length > 0 && (
        <div className="reassurance-green-strip">
          <div className="reassurance-icon-badge">
            <Icon name="check" size={20} />
          </div>
          <p className="reassurance-copy-text">{t("saveTrip")}</p>
        </div>
      )}

      <div className="screen-bottom-action">
        <PrimaryButton onClick={onNext} disabled={loading}>{t("toReadiness")}</PrimaryButton>
      </div>

      <BottomHelpBar onHelpClick={onOpenHelp} label={t("help")} />
    </div>
  );
}

export default Screen5Problems;
