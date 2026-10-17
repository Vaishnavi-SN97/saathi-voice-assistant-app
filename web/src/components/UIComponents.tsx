import type { ReactNode } from "react";
import { Icon } from "./Icons";
import type { IconName } from "../types";

/**
 * 1. Primary Button
 * Full width, 64px tall, 16px radius, bold 20px label, high contrast (WCAG AA).
 * Only ONE primary action per screen.
 */
export function PrimaryButton({
  children,
  onClick,
  icon,
  disabled = false,
  className = "",
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  icon?: IconName;
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`primary-btn ${className}`}
    >
      <span className="btn-label">{children}</span>
      <span className="btn-icon">
        <Icon name={icon || "arrow"} size={24} />
      </span>
    </button>
  );
}

/**
 * 2. Secondary Button
 * 64px tall, 16px radius, bold 20px label, high contrast outlined/tinted style.
 */
export function SecondaryButton({
  children,
  onClick,
  icon,
  variant = "outline",
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  icon?: IconName;
  variant?: "outline" | "text" | "success";
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`secondary-btn secondary-btn--${variant} ${className}`}
    >
      {icon && <Icon name={icon} size={22} />}
      <span className="btn-label">{children}</span>
    </button>
  );
}

/**
 * 3. Progress Dots
 * Simple dots: Step 1 of 4: Talk, Check, Review, Sign.
 * Every screen shows this indicator.
 */
export function ProgressDots({
  activeStep,
}: {
  activeStep: 0 | 1 | 2 | 3; // 0: Talk, 1: Check, 2: Review, 3: Sign
}) {
  const steps = [
    { id: 0, label: "Talk", labelHi: "बातचीत", labelKn: "ಮಾತನಾಡಿ" },
    { id: 1, label: "Check", labelHi: "जाँच", labelKn: "ಪರಿಶೀಲನೆ" },
    { id: 2, label: "Review", labelHi: "समीक्षा", labelKn: "ಪರಿಶೀಲಿಸಿ" },
    { id: 3, label: "Sign", labelHi: "हस्ताक्षर", labelKn: "ಸಹಿ" },
  ];

  return (
    <div
      className="progress-container"
      aria-label={`Step ${activeStep + 1} of 4: ${steps[activeStep].label}`}
    >
      <div className="progress-bar-track">
        <div
          className="progress-bar-fill"
          style={{ width: `${(activeStep / 3) * 100}%` }}
        />
      </div>
      <div className="progress-steps">
        {steps.map((step) => {
          const isDone = step.id < activeStep;
          const isCurrent = step.id === activeStep;
          return (
            <div
              key={step.id}
              className={`progress-step-item ${
                isDone ? "step-done" : isCurrent ? "step-current" : "step-pending"
              }`}
            >
              <div className="step-bubble">
                {isDone ? (
                  <Icon name="check" size={15} />
                ) : (
                  <span>{step.id + 1}</span>
                )}
              </div>
              <span className="step-text">{step.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * 4. Question Card
 * Centre: current question in very large text (30px),
 * with "Listen again" speaker button and "Speak slower" toggle.
 */
export function QuestionCard({
  question,
  onListenAgain,
  slowMode,
  onToggleSlow,
  chipText = "Question 3 of 12",
  subtitle = "Please tell me",
}: {
  question: string;
  onListenAgain?: () => void;
  slowMode: boolean;
  onToggleSlow: () => void;
  chipText?: string;
  subtitle?: string;
}) {
  return (
    <div className="question-card">
      {chipText && <div className="question-chip">{chipText}</div>}
      <p className="question-subtitle">{subtitle}</p>
      <h2 className="question-headline">{question}</h2>
      <div className="question-controls">
        <button
          type="button"
          onClick={onListenAgain}
          className="listen-pill-btn"
          aria-label="Listen again"
        >
          <Icon name="speaker" size={22} />
          <span>Listen again</span>
        </button>
        <button
          type="button"
          onClick={onToggleSlow}
          className={`slow-toggle-btn ${slowMode ? "active" : ""}`}
          aria-pressed={slowMode}
        >
          <span className="switch-track">
            <span className="switch-thumb" />
          </span>
          <span>Speak slower</span>
        </button>
      </div>
    </div>
  );
}

/**
 * 5. Answer Confirm Card
 * Card titled "Did I hear this right?" showing the answer in large text,
 * with two big buttons side by side: green "Yes, correct" and outlined "No, say again",
 * and a small link "Type instead".
 */
export function AnswerConfirmCard({
  title = "Did I hear this right?",
  answer = "Ramesh Kumar Shetty",
  onConfirm,
  onReject,
  onTypeInstead,
  confirmLabel = "Yes, correct",
  rejectLabel = "No, say again",
  typeInsteadLabel = "Type instead",
}: {
  title?: string;
  answer: string;
  onConfirm?: () => void;
  onReject?: () => void;
  onTypeInstead?: () => void;
  confirmLabel?: string;
  rejectLabel?: string;
  typeInsteadLabel?: string;
}) {
  return (
    <div className="answer-confirm-card">
      <p className="answer-prompt-title">{title}</p>
      <div className="answer-detected-text">{answer}</div>
      <div className="answer-button-pair">
        <button
          type="button"
          onClick={onConfirm}
          className="answer-action-btn answer-btn-yes"
        >
          <Icon name="check" size={22} />
          <span>{confirmLabel}</span>
        </button>
        <button
          type="button"
          onClick={onReject}
          className="answer-action-btn answer-btn-no"
        >
          <Icon name="mic" size={22} />
          <span>{rejectLabel}</span>
        </button>
      </div>
      <button
        type="button"
        onClick={onTypeInstead}
        className="type-instead-link"
      >
        {typeInsteadLabel}
      </button>
    </div>
  );
}

/**
 * 6. Warning Banner
 * Amber banner for OTP warning or security reassurance.
 */
export function WarningBanner({
  message = "Please never share your OTP or PIN with anyone, not even with us. We did not save it.",
  icon = "shield",
  variant = "amber",
}: {
  message?: string;
  icon?: IconName;
  variant?: "amber" | "teal" | "green";
}) {
  return (
    <div className={`warning-banner-box banner--${variant}`} role="alert">
      <div className="banner-icon-badge">
        <Icon name={icon} size={22} />
      </div>
      <p className="banner-message-text">{message}</p>
    </div>
  );
}

/**
 * 7. Checklist Row
 * Row item for readiness check or requirements.
 * Touch target at least 56px.
 */
export function ChecklistRow({
  label,
  isComplete = true,
  statusBadge,
  icon,
}: {
  label: string;
  isComplete?: boolean;
  statusBadge?: string;
  icon?: IconName;
}) {
  return (
    <div className="checklist-row-item">
      <div
        className={`checklist-indicator ${
          isComplete ? "indicator-success" : "indicator-warning"
        }`}
      >
        <Icon name={isComplete ? "check" : icon || "alert"} size={20} />
      </div>
      <span className="checklist-row-label">{label}</span>
      {statusBadge && (
        <span
          className={`checklist-badge-pill ${
            isComplete ? "badge-success" : "badge-amber"
          }`}
        >
          {statusBadge}
        </span>
      )}
    </div>
  );
}

/**
 * 8. Language Card
 * Large tappable card with language name in its own script,
 * plus a speaker icon that says the language name aloud.
 */
export function LanguageCard({
  scriptName,
  englishName,
  isSelected = false,
  onSelect,
  onSpeak,
}: {
  scriptName: string;
  englishName: string;
  isSelected?: boolean;
  onSelect: () => void;
  onSpeak: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      className={`language-card-item ${isSelected ? "selected" : ""}`}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          onSelect();
        }
      }}
    >
      <div className="lang-text-group">
        <strong className="lang-script-title">{scriptName}</strong>
        <span className="lang-english-sub">{englishName}</span>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onSpeak();
        }}
        className="lang-speaker-btn"
        aria-label={`Listen to ${englishName}`}
      >
        <Icon name="speaker" size={24} />
      </button>
    </div>
  );
}

/**
 * 9. Bottom Help Bar
 * Always show a small "Help / talk to a person" link at the bottom of every screen.
 * Touch target at least 56px.
 */
export function BottomHelpBar({
  onHelpClick,
  label = "Help / talk to a person",
}: {
  onHelpClick?: () => void;
  label?: string;
}) {
  return (
    <footer className="bottom-help-footer">
      <button
        type="button"
        onClick={onHelpClick}
        className="help-link-button"
        aria-label="Get human assistance"
      >
        <Icon name="headset" size={22} />
        <span>{label}</span>
      </button>
    </footer>
  );
}

export default {
  PrimaryButton,
  SecondaryButton,
  ProgressDots,
  QuestionCard,
  AnswerConfirmCard,
  WarningBanner,
  ChecklistRow,
  LanguageCard,
  BottomHelpBar,
};
