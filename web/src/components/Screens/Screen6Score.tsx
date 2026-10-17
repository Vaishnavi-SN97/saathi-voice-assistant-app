import { Icon } from "../Icons";
import {
  PrimaryButton,
  ProgressDots,
  ChecklistRow,
  BottomHelpBar,
} from "../UIComponents";
import { speakText } from "../../utils/speech";

export function Screen6Score({
  onNext,
  onBack,
  onOpenHelp,
}: {
  onNext: () => void;
  onBack: () => void;
  onOpenHelp: () => void;
}) {
  const checklistItems = [
    { label: "Name matches", isComplete: true, badge: "✓ Verified" },
    { label: "Date of birth matches", isComplete: true, badge: "✓ Verified" },
    { label: "Aadhaar valid", isComplete: true, badge: "✓ Active" },
    { label: "PAN valid", isComplete: true, badge: "✓ Linked" },
    { label: "Passbook clear", isComplete: true, badge: "✓ Legible" },
    {
      label: "Nominee details",
      isComplete: false,
      badge: "1 left",
    },
  ];

  const handleListenScore = () => {
    speakText(
      "Your readiness score is 92% ready. Name, Date of Birth, Aadhaar, PAN, and Passbook are verified. Only one nominee detail remains.",
      "en-IN"
    );
  };

  return (
    <div className="screen-container score-screen-wrapper">
      {/* Top Progress indicator (Step 3: Review) */}
      <ProgressDots activeStep={2} />

      {/* Top bar with back button & speaker */}
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

        <button
          type="button"
          onClick={handleListenScore}
          className="listen-pill-btn"
          aria-label="Listen to score overview"
        >
          <Icon name="speaker" size={22} />
          <span>Listen</span>
        </button>
      </div>

      {/* Hero Circular Progress Ring (92% ready) */}
      <div className="readiness-ring-hero">
        <div className="circular-progress-ring-box">
          <svg className="ring-svg-circle" viewBox="0 0 160 160" aria-hidden="true">
            {/* Background ring */}
            <circle
              className="ring-bg-track"
              cx="80"
              cy="80"
              r="66"
              strokeWidth="14"
            />
            {/* Filled progress ring (92% of 2*PI*66 = ~414.7, offset = 414.7 * 0.08 = ~33) */}
            <circle
              className="ring-value-stroke"
              cx="80"
              cy="80"
              r="66"
              strokeWidth="14"
              strokeDasharray="415"
              strokeDashoffset="33"
            />
          </svg>

          {/* Center text: 92% ready */}
          <div className="ring-center-content">
            <span className="ring-percentage-num">92%</span>
            <span className="ring-ready-label">ready</span>
          </div>

          {/* Green check badge at bottom corner */}
          <div className="ring-green-check-badge">
            <Icon name="check" size={24} />
          </div>
        </div>

        <h1 className="screen-main-heading score-main-heading">
          Your form is almost ready
        </h1>
        <p className="screen-sub-description">
          Saathi checked all your documents and spellings.
        </p>
      </div>

      {/* Checklist items */}
      <div className="readiness-checklist-card">
        {checklistItems.map((item, idx) => (
          <ChecklistRow
            key={idx}
            label={item.label}
            isComplete={item.isComplete}
            statusBadge={item.badge}
          />
        ))}
      </div>

      {/* Reassurance text */}
      <p className="nominee-help-note">
        You can fill the nominee name at the bank counter or keep it as is.
      </p>

      {/* Primary Action Button */}
      <div className="screen-bottom-action">
        <PrimaryButton onClick={onNext}>
          Send to bank officer
        </PrimaryButton>
      </div>

      {/* Bottom Help Link */}
      <BottomHelpBar onHelpClick={onOpenHelp} />
    </div>
  );
}

export default Screen6Score;
