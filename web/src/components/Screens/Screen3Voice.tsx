import { useState, useEffect } from "react";
import { Icon } from "../Icons";
import {
  ProgressDots,
  QuestionCard,
  AnswerConfirmCard,
  WarningBanner,
  BottomHelpBar,
} from "../UIComponents";
import { speakText } from "../../utils/speech";

export function Screen3Voice({
  onNext,
  onBack,
  onOpenHelp,
  isHindi = false,
}: {
  onNext: () => void;
  onBack: () => void;
  onOpenHelp: () => void;
  isHindi?: boolean;
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [slowSpeech, setSlowSpeech] = useState(false);
  const [isOtpVariant, setIsOtpVariant] = useState(false);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [typedName, setTypedName] = useState("Ramesh Kumar Shetty");

  const questionEn = "What is your full name?";
  const questionHi = "आपका पूरा नाम क्या है?";
  const currentQuestion = isHindi ? questionHi : questionEn;
  const currentLangCode = isHindi ? "hi-IN" : "en-IN";

  // Trigger speech on initial view or listen again
  const handleListenAgain = () => {
    speakText(currentQuestion, currentLangCode, slowSpeech);
  };

  const handleToggleSlow = () => {
    const nextSlow = !slowSpeech;
    setSlowSpeech(nextSlow);
    speakText(
      nextSlow ? "Speaking slower now." : "Normal speed.",
      "en-IN",
      nextSlow
    );
  };

  const handleToggleMic = () => {
    if (!isRecording) {
      setIsRecording(true);
      speakText(isHindi ? "सुन रहे हैं, बोलिए..." : "Listening, please speak your name...", currentLangCode, slowSpeech);
    } else {
      setIsRecording(false);
    }
  };

  // Auto stop listening simulation after 4 seconds
  useEffect(() => {
    if (isRecording) {
      const timer = setTimeout(() => {
        setIsRecording(false);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [isRecording]);

  return (
    <div className="screen-container voice-hero-screen">
      {/* Top Progress indicator (Step 1: Talk) */}
      <ProgressDots activeStep={0} />

      {/* Top action bar with back button */}
      <div className="top-action-bar">
        <button
          type="button"
          onClick={onBack}
          className="nav-back-btn"
          aria-label="Go back"
        >
          <Icon name="chevron" size={24} className="rotate-180" />
          <span>Back</span>
        </button>

        {/* State Variant Toggle: Normal vs OTP Security Warning */}
        <div className="variant-pill-toggle">
          <button
            type="button"
            onClick={() => setIsOtpVariant(!isOtpVariant)}
            className={`variant-toggle-btn ${isOtpVariant ? "active" : ""}`}
            title="Toggle state variant to demonstrate the security warning"
          >
            <Icon name="shield" size={16} />
            <span>{isOtpVariant ? "Hide OTP Warning" : "Test OTP Warning"}</span>
          </button>
        </div>
      </div>

      {/* Centre: Current Question in very large 30px text */}
      <QuestionCard
        chipText={isHindi ? "प्रश्न ३ / १२" : "Question 3 of 12"}
        subtitle={isHindi ? "कृपया बताइए" : "Please tell me"}
        question={currentQuestion}
        onListenAgain={handleListenAgain}
        slowMode={slowSpeech}
        onToggleSlow={handleToggleSlow}
      />

      {/* Hero 120px Circular Microphone Button with Animated Pulse Rings */}
      <div className="voice-mic-hero-section">
        <div className="mic-rings-wrapper">
          {/* Animated Soft Pulse Rings */}
          <div className={`pulse-ring pulse-ring-1 ${isRecording ? "pulsing" : ""}`} />
          <div className={`pulse-ring pulse-ring-2 ${isRecording ? "pulsing" : ""}`} />
          <div className={`pulse-ring pulse-ring-3 ${isRecording ? "pulsing" : ""}`} />

          <button
            type="button"
            onClick={handleToggleMic}
            className={`hero-mic-circle-btn ${isRecording ? "recording-active" : ""}`}
            aria-label={isRecording ? "Listening... tap to pause" : "Tap and speak"}
          >
            <Icon name="mic" size={54} />
          </button>
        </div>

        <strong className="mic-action-label">
          {isRecording
            ? isHindi
              ? "साथी सुन रहा है..."
              : "Listening... speak now"
            : isHindi
            ? "बोलने के लिए दबाएं"
            : "Tap and speak"}
        </strong>

        {/* Live Waveform Area */}
        <div
          className={`live-waveform-bar-container ${
            isRecording ? "waveform-active" : "waveform-idle"
          }`}
          aria-hidden="true"
        >
          {[16, 32, 54, 28, 62, 45, 58, 30, 48, 22, 40, 18].map(
            (height, idx) => (
              <span
                key={idx}
                className="wave-bar"
                style={{
                  height: `${height}px`,
                  animationDelay: `${idx * 0.08}s`,
                }}
              />
            )
          )}
        </div>
      </div>

      {/* State Variant: Amber Banner when user says something like OTP */}
      {isOtpVariant && (
        <div className="otp-variant-slide-in">
          <WarningBanner
            message="Please never share your OTP or PIN with anyone, not even with us. We did not save it."
            icon="shield"
            variant="amber"
          />
        </div>
      )}

      {/* Answer Confirmation Card */}
      <AnswerConfirmCard
        title={isHindi ? "क्या मैंने सही सुना?" : "Did I hear this right?"}
        answer={typedName}
        onConfirm={onNext}
        onReject={() => {
          setIsRecording(true);
          speakText("Please say your full name once again.", currentLangCode);
        }}
        onTypeInstead={() => setShowTypeModal(true)}
        confirmLabel={isHindi ? "हाँ, सही है" : "Yes, correct"}
        rejectLabel={isHindi ? "नहीं, फिर से बोलें" : "No, say again"}
        typeInsteadLabel={isHindi ? "लिखकर दर्ज करें" : "Type instead"}
      />

      {/* Bottom Help Bar */}
      <BottomHelpBar onHelpClick={onOpenHelp} />

      {/* "Type instead" Modal */}
      {showTypeModal && (
        <div className="app-modal-overlay" role="dialog" aria-modal="true">
          <div className="app-modal-card">
            <div className="modal-header">
              <div className="modal-icon-badge">
                <Icon name="document" size={26} />
              </div>
              <h3 className="modal-title">Type your name</h3>
            </div>
            <div className="modal-body-content">
              <p>You can edit your full name below using the keypad:</p>
              <input
                type="text"
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                className="name-text-input"
                autoFocus
              />
            </div>
            <div className="modal-actions-pair">
              <button
                type="button"
                onClick={() => setShowTypeModal(false)}
                className="modal-close-primary-btn"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Screen3Voice;
