import { useCallback, useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Icon } from "../Icons";
import { PrimaryButton, ProgressDots, ChecklistRow, WarningBanner, BottomHelpBar } from "../UIComponents";
import { useI18n, type Key } from "../../lib/i18n";
import { api, ApiError } from "../../lib/api";
import { useSession, type CheckResult } from "../../lib/session";
import { speakServer } from "../../lib/speak";
import { useSpokenError } from "../../lib/spokenError";

const CIRCUMFERENCE = 415; // 2 * PI * 66

export function Screen6Score({ onNext, onBack, onOpenHelp }: { onNext: () => void; onBack: () => void; onOpenHelp: () => void }) {
  const { t, lang } = useI18n();
  const session = useSession();
  const navigate = useNavigate();
  const { appId, appLang, check } = session;
  const msgLang = appLang ?? lang;

  const [loading, setLoading] = useState(!check);
  const [sending, setSending] = useState(false);
  const [notEligible, setNotEligible] = useState(false);
  const [error, setError] = useState<{ text: string; retry: () => void } | null>(null);
  useSpokenError(error?.text ?? (notEligible ? t("notEligible") : null), msgLang);

  const fail = (e: unknown, retry: () => void) => {
    const status = e instanceof ApiError ? e.status : 0;
    setError({ text: status === -1 ? t("notConfigured") : status === 0 ? (navigator.onLine ? t("netError") : t("offline")) : t("genericError"), retry });
  };

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

  const send = async () => {
    setSending(true);
    setError(null);
    setNotEligible(false);
    try {
      await api(`/applications/${appId}/submit`, { json: {} });
      onNext();
    } catch (e) {
      if (e instanceof ApiError && e.code === "not_eligible") {
        setNotEligible(true);
        void load(); // refresh the list of what is still wrong
      } else {
        fail(e, () => void send());
      }
    } finally {
      setSending(false);
    }
  };

  if (!appId) return <Navigate to="/" replace />;

  const score = check?.readiness.score ?? 0;
  const items = check?.readiness.items ?? [];
  const todos = items.filter((i) => !i.done && i.todo);
  const ready = (check?.eligible ?? false) && score >= 90;

  const handleListen = () => {
    const text = [t("scoreSpeech", { score }), ...todos.map((i) => i.todo![msgLang])].join(" ");
    void speakServer(text, msgLang);
  };

  return (
    <div className="screen-container score-screen-wrapper">
      <ProgressDots activeStep={2} />

      <div className="top-action-bar">
        <button type="button" onClick={onBack} className="nav-back-btn" aria-label={t("back")}>
          <Icon name="chevron" size={24} className="rotate-180" />
          <span>{t("back")}</span>
        </button>

        <button type="button" onClick={handleListen} className="listen-pill-btn" aria-label={t("listen")} disabled={!check}>
          <Icon name="speaker" size={22} />
          <span>{t("listen")}</span>
        </button>
      </div>

      {/* Score ring from the API */}
      <div className="readiness-ring-hero">
        <div className="circular-progress-ring-box">
          <svg className="ring-svg-circle" viewBox="0 0 160 160" aria-hidden="true">
            <circle className="ring-bg-track" cx="80" cy="80" r="66" strokeWidth="14" />
            <circle
              className="ring-value-stroke"
              cx="80"
              cy="80"
              r="66"
              strokeWidth="14"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE * (1 - score / 100)}
            />
          </svg>

          <div className="ring-center-content">
            <span className="ring-percentage-num">{loading ? "…" : `${score}%`}</span>
            <span className="ring-ready-label">{t("ready")}</span>
          </div>

          {ready && (
            <div className="ring-green-check-badge">
              <Icon name="check" size={24} />
            </div>
          )}
        </div>

        <h1 className="screen-main-heading score-main-heading">{ready ? t("readyHeadingDone") : t("readyHeadingAlmost")}</h1>
        <p className="screen-sub-description">{t("readySub")}</p>
      </div>

      {error && (
        <div className="api-error-box" role="alert">
          <WarningBanner message={error.text} icon="alert" variant="amber" />
          <button type="button" className="retry-link-btn" onClick={error.retry}>{t("tryAgain")}</button>
        </div>
      )}

      {/* Checklist from the API */}
      <div className="readiness-checklist-card">
        {items.map((i) => (
          <ChecklistRow
            key={i.id}
            label={t(`ck_${i.id}` as Key)}
            isComplete={i.done}
            statusBadge={i.done ? "✓" : `${Math.round(i.points)}/${i.max}`}
          />
        ))}
      </div>

      {todos.length > 0 && (
        <div className="todo-list-card">
          <strong>{t("todoTitle")}</strong>
          <ul>
            {todos.map((i) => (
              <li key={i.id}>{i.todo![msgLang]}</li>
            ))}
          </ul>
        </div>
      )}

      {notEligible && (
        <div className="api-error-box" role="alert">
          <WarningBanner message={t("notEligible")} icon="alert" variant="amber" />
          <button type="button" className="retry-link-btn" onClick={() => navigate("/problems")}>{t("fixProblems")}</button>
        </div>
      )}

      <div className="screen-bottom-action">
        <PrimaryButton onClick={() => void send()} disabled={loading || sending}>
          {sending ? t("sending") : t("sendBank")}
        </PrimaryButton>
      </div>

      <BottomHelpBar onHelpClick={onOpenHelp} label={t("help")} />
    </div>
  );
}

export default Screen6Score;
