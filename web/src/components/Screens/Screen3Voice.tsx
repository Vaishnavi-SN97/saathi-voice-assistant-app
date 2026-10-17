import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { Icon } from "../Icons";
import {
  ProgressDots,
  QuestionCard,
  AnswerConfirmCard,
  WarningBanner,
  BottomHelpBar,
} from "../UIComponents";
import { speakText } from "../../utils/speech";
import { LANG_CODE, useI18n } from "../../lib/i18n";
import { api, ApiError } from "../../lib/api";
import { audioExt, canRecord, playUrl, startRecording, stopAudio, type RecordingHandle } from "../../lib/audio";
import { toQuestion, useSession, type Question } from "../../lib/session";
import { useSpokenError } from "../../lib/spokenError";
import { speakServer } from "../../lib/speak";

const MAX_MS = 12_000;
const SLOW_PACE = 0.75;
const BARS = [16, 32, 54, 28, 62, 45, 58, 30, 48, 22, 40, 18];

type Phase = "idle" | "recording" | "busy" | "confirming";
interface Spoken { text: string; audioUrl: string }
interface QuestionPayload { id: string; type: string; text: string; audioUrl: string; options?: { value: string; label: string }[] }
interface AnswerResponse {
  state: "asking" | "confirming";
  blocked?: boolean;
  warning?: Spoken;
  question?: QuestionPayload;
  readback?: Spoken;
  display?: string;
  message?: Spoken;
  typingFallback?: boolean;
  progress?: { done: number; total: number };
}
interface ConfirmResponse {
  state: "asking" | "confirming" | "docs_pending";
  blocked?: boolean;
  warning?: Spoken;
  question?: QuestionPayload;
  readback?: Spoken;
  message?: Spoken;
  buttonFallback?: boolean;
  progress?: { done: number; total: number };
}
interface SttResponse { transcript: string; blocked: boolean; warning?: Spoken }

export function Screen3Voice({
  onNext,
  onBack,
  onOpenHelp,
}: {
  onNext: () => void;
  onBack: () => void;
  onOpenHelp: () => void;
}) {
  const { t } = useI18n();
  const session = useSession();
  const { appId, appLang, question, progress } = session;

  const [phase, setPhase] = useState<Phase>("idle");
  const [slowSpeech, setSlowSpeech] = useState(false);
  const [readback, setReadback] = useState<{ audioUrl: string; text: string; display: string } | null>(null);
  const [scamWarning, setScamWarning] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<{ text: string; retry?: () => void } | null>(null);
  const [level, setLevel] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [typing, setTyping] = useState<{ open: boolean; value: string }>({ open: false, value: "" });
  const recorder = useRef<RecordingHandle | null>(null);
  useSpokenError(error?.text, appLang ?? "en");

  const langCode = LANG_CODE[appLang ?? "en"];

  /** Play server audio; fall back to the browser voice if the file cannot play (not if autoplay is blocked). */
  const say = useCallback(
    (audioUrl: string | undefined, fallbackText: string) => {
      if (!audioUrl) return;
      playUrl(audioUrl).catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "NotAllowedError") return; // user can tap "Listen again"
        void speakServer(fallbackText, appLang ?? "en"); // stale link (10-minute token) or missing file: fresh /tts link, browser voice as last resort
      });
    },
    [appLang],
  );

  // Read each new question aloud once.
  const qId = question?.id;
  useEffect(() => {
    if (question) say(question.audioUrl, question.text);
    return () => stopAudio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qId]);

  // Stop the microphone if the screen goes away mid-recording.
  useEffect(() => () => recorder.current?.stop(), []);

  const fail = (e: unknown, retry?: () => void) => {
    setPhase((p) => (p === "confirming" ? p : "idle"));
    const status = e instanceof ApiError ? e.status : 0;
    setError({
      text: status === -1 ? t("notConfigured") : status === 0 ? t("netError") : status === 401 ? t("sessionExpired") : t("genericError"),
      retry: status === -1 || status === 401 ? undefined : retry,
    });
  };

  /** Apply the server's reply to /interview/answer. */
  const applyAnswer = (r: AnswerResponse) => {
    if (r.progress) session.setProgress(r.progress);
    if (r.blocked && r.warning) {
      setScamWarning(r.warning.text);
      say(r.warning.audioUrl, r.warning.text);
      if (r.question) session.setQuestion(toQuestion(r.question));
      setPhase("idle");
      return;
    }
    if (r.state === "confirming" && r.readback) {
      setReadback({ ...r.readback, display: r.display ?? "" });
      setPhase("confirming");
      say(r.readback.audioUrl, r.readback.text);
      return;
    }
    // Not understood: retry message, and the typing fallback after repeated failures.
    if (r.question) session.setQuestion(toQuestion(r.question));
    if (r.message) {
      setInfo(r.message.text);
      say(r.message.audioUrl, r.message.text);
    }
    setPhase("idle");
    if (r.typingFallback) setTyping({ open: true, value: "" });
  };

  const sendAnswer = async (text: string, source: "voice" | "typed") => {
    setPhase("busy");
    setError(null);
    try {
      applyAnswer(await api<AnswerResponse>("/interview/answer", { json: { appId, text, source } }));
    } catch (e) {
      fail(e, () => void sendAnswer(text, source));
    }
  };

  const sendAudio = async (blob: Blob) => {
    setPhase("busy");
    setError(null);
    try {
      const fd = new FormData();
      fd.append("audio", blob, `answer.${audioExt(blob.type)}`);
      fd.append("language", appLang ?? "en");
      if (appId) fd.append("appId", appId);
      const stt = await api<SttResponse>("/voice/stt", { form: fd });
      if (stt.blocked && stt.warning) {
        // Scam shield: nothing was kept. Show and speak the warning, stay on the same question.
        setScamWarning(stt.warning.text);
        say(stt.warning.audioUrl, stt.warning.text);
        setPhase("idle");
        return;
      }
      if (!stt.transcript.trim()) {
        setInfo(t("noSpeech"));
        setPhase("idle");
        return;
      }
      await sendAnswer(stt.transcript, "voice");
    } catch (e) {
      fail(e, () => void sendAudio(blob));
    }
  };

  const handleToggleMic = async () => {
    if (phase === "recording") {
      recorder.current?.stop();
      return;
    }
    if (phase !== "idle") return;
    setError(null);
    setInfo(null);
    setScamWarning(null);
    stopAudio();
    if (!canRecord()) {
      setError({ text: t("micUnsupported") });
      return;
    }
    let handle: RecordingHandle;
    try {
      handle = await startRecording({ maxMs: MAX_MS, onLevel: setLevel, onTick: setElapsed });
    } catch {
      setError({ text: t("micDenied") });
      return;
    }
    recorder.current = handle;
    setElapsed(0);
    setPhase("recording");
    const blob = await handle.done;
    recorder.current = null;
    await sendAudio(blob);
  };

  const confirm = async (yes: boolean) => {
    setPhase("busy");
    setError(null);
    try {
      const r = await api<ConfirmResponse>("/interview/confirm", { json: { appId, confirmed: yes } });
      if (r.progress) session.setProgress(r.progress);
      setReadback(null);
      if (r.state === "docs_pending") {
        onNext();
        return;
      }
      if (r.question) session.setQuestion(toQuestion(r.question));
      setPhase("idle");
      if (!yes && r.question) say(r.question.audioUrl, r.question.text); // "No, say again": ask again
    } catch (e) {
      fail(e, () => void confirm(yes));
      setPhase("confirming");
    }
  };

  const listenAgain = async () => {
    stopAudio();
    const target: { text: string; audioUrl: string } | null =
      phase === "confirming" && readback ? readback : question ? { text: question.text, audioUrl: question.audioUrl } : null;
    if (!target) return;
    if (!slowSpeech) return say(target.audioUrl, target.text);
    // Slower: ask the server for the same sentence at a lower pace (cached after the first time).
    try {
      const r = await api<{ audioUrl: string }>("/tts", { json: { text: target.text, language: appLang ?? "en", pace: SLOW_PACE } });
      say(r.audioUrl, target.text);
    } catch {
      speakText(target.text, langCode, true);
    }
  };

  const handleToggleSlow = () => setSlowSpeech((s) => !s);

  if (!appId || !question) return <Navigate to="/" replace />;

  const isRecording = phase === "recording";
  const busy = phase === "busy";
  const secs = Math.min(12, Math.floor(elapsed / 1000));
  const total = progress.total;

  const submitTyped = (text: string) => {
    const v = text.trim();
    if (!v) return;
    setTyping({ open: false, value: "" });
    void sendAnswer(v, "typed");
  };
  const pickOption = (o: NonNullable<Question["options"]>[number]) => void sendAnswer(o.label, "typed");

  return (
    <div className="screen-container voice-hero-screen">
      <ProgressDots activeStep={0} />

      <div className="top-action-bar">
        <button type="button" onClick={onBack} className="nav-back-btn" aria-label={t("back")}>
          <Icon name="chevron" size={24} className="rotate-180" />
          <span>{t("back")}</span>
        </button>
      </div>

      <QuestionCard
        chipText={t("qChip", { n: Math.min(progress.done + 1, total), total })}
        subtitle={t("pleaseTell")}
        question={question.text}
        onListenAgain={listenAgain}
        slowMode={slowSpeech}
        onToggleSlow={handleToggleSlow}
        listenLabel={t("listenAgain")}
        slowLabel={t("speakSlower")}
      />

      {/* Choice fields: tap an option instead of speaking */}
      {question.options && phase === "idle" && (
        <div className="option-chip-row" aria-label={t("pickOne")}>
          {question.options.map((o) => (
            <button key={o.value} type="button" className="option-chip" onClick={() => pickOption(o)}>
              {o.label}
            </button>
          ))}
        </div>
      )}

      {/* Microphone: tap to start, tap to stop (12 s max), live level meter */}
      <div className="voice-mic-hero-section">
        <div className="mic-rings-wrapper">
          <div className={`pulse-ring pulse-ring-1 ${isRecording ? "pulsing" : ""}`} />
          <div className={`pulse-ring pulse-ring-2 ${isRecording ? "pulsing" : ""}`} />
          <div className={`pulse-ring pulse-ring-3 ${isRecording ? "pulsing" : ""}`} />

          <button
            type="button"
            onClick={handleToggleMic}
            disabled={busy || phase === "confirming"}
            className={`hero-mic-circle-btn ${isRecording ? "recording-active" : ""}`}
            aria-label={isRecording ? t("listening") : t("tapSpeak")}
          >
            <Icon name="mic" size={54} />
          </button>
        </div>

        <strong className="mic-action-label">
          {busy ? t("thinking") : isRecording ? t("listening") : t("tapSpeak")}
        </strong>
        {isRecording && <span className="mic-timer">{t("timeLimit", { s: secs })}</span>}

        <div className={`live-waveform-bar-container ${isRecording ? "waveform-live" : busy ? "waveform-active" : "waveform-idle"}`} aria-hidden="true">
          {BARS.map((height, idx) => (
            <span
              key={idx}
              className="wave-bar"
              style={{
                height: `${height}px`,
                animationDelay: `${idx * 0.08}s`,
                ...(isRecording ? { transform: `scaleY(${Math.max(0.15, Math.min(1, level * (0.6 + (idx % 4) * 0.2)))})` } : {}),
              }}
            />
          ))}
        </div>
      </div>

      {/* Scam shield: amber banner, nothing was saved */}
      {scamWarning && (
        <div className="otp-variant-slide-in">
          <WarningBanner message={scamWarning} icon="shield" variant="amber" />
        </div>
      )}
      {info && !scamWarning && <WarningBanner message={info} icon="alert" variant="teal" />}
      {error && (
        <div className="api-error-box" role="alert">
          <WarningBanner message={error.text} icon="alert" variant="amber" />
          {error.retry && (
            <button type="button" className="retry-link-btn" onClick={error.retry}>
              {t("tryAgain")}
            </button>
          )}
        </div>
      )}

      {/* Read-back: "Did I hear this right?" */}
      {phase === "confirming" && readback && (
        <AnswerConfirmCard
          title={t("didIHear")}
          answer={readback.display || readback.text}
          onConfirm={() => void confirm(true)}
          onReject={() => void confirm(false)}
          onTypeInstead={() => setTyping({ open: true, value: "" })}
          confirmLabel={t("yesCorrect")}
          rejectLabel={t("noSayAgain")}
          typeInsteadLabel={t("typeInstead")}
        />
      )}
      {phase === "idle" && (
        <button type="button" className="type-instead-link standalone" onClick={() => setTyping({ open: true, value: "" })}>
          {t("typeInstead")}
        </button>
      )}

      <BottomHelpBar onHelpClick={onOpenHelp} label={t("help")} />

      {/* "Type instead" modal */}
      {typing.open && (
        <div className="app-modal-overlay" role="dialog" aria-modal="true">
          <form
            className="app-modal-card"
            onSubmit={(e) => {
              e.preventDefault();
              submitTyped(typing.value);
            }}
          >
            <div className="modal-header">
              <div className="modal-icon-badge">
                <Icon name="document" size={26} />
              </div>
              <h3 className="modal-title">{t("typeTitle")}</h3>
            </div>
            <div className="modal-body-content">
              <p>{question.text}</p>
              <p>{t("typeHint")}</p>
              <input
                type="text"
                value={typing.value}
                onChange={(e) => setTyping({ open: true, value: e.target.value })}
                className="name-text-input"
                autoFocus
                inputMode={question.type === "mobile" ? "tel" : "text"}
              />
            </div>
            <div className="modal-actions-pair">
              <button type="button" onClick={() => setTyping({ open: false, value: "" })} className="modal-secondary-btn">
                {t("cancel")}
              </button>
              <button type="submit" className="modal-close-primary-btn" disabled={!typing.value.trim()}>
                {t("send")}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default Screen3Voice;
