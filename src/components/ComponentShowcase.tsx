import { useState } from "react";
import {
  PrimaryButton,
  SecondaryButton,
  QuestionCard,
  AnswerConfirmCard,
  WarningBanner,
  ChecklistRow,
  LanguageCard,
  ProgressDots,
  BottomHelpBar,
} from "./UIComponents";
import { Icon } from "./Icons";
import { speakText } from "../utils/speech";

export function ComponentShowcase({
  onOpenHelp,
}: {
  onOpenHelp: () => void;
}) {
  const [slowMode, setSlowMode] = useState(false);
  const [selectedLang, setSelectedLang] = useState("हिन्दी");
  const [activeStep, setActiveStep] = useState<0 | 1 | 2 | 3>(0);
  const [feedback, setFeedback] = useState<string>("");

  const triggerFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(""), 3000);
  };

  return (
    <div className="component-showcase-view">
      <div className="showcase-header">
        <div className="showcase-badge">
          <Icon name="check" size={16} /> Design System & Component Library
        </div>
        <h1 className="showcase-title">Saathi Senior-First UI Components</h1>
        <p className="showcase-desc">
          Crafted specifically for Indian senior citizens (60+). All components
          strictly enforce WCAG AA contrast, body text ≥ 18px, headings 28px,
          key question text 30px, 64px button heights, and touch targets ≥ 56px.
        </p>
        {feedback && <div className="feedback-toast-pill">{feedback}</div>}
      </div>

      <div className="showcase-grid-layout">
        {/* 1. Progress Dots */}
        <section className="showcase-card">
          <div className="component-meta">
            <span className="comp-number">01</span>
            <div className="comp-title-wrap">
              <h3>Progress Dots (4 Steps)</h3>
              <p>Talk · Check · Review · Sign with connecting line</p>
            </div>
          </div>
          <div className="comp-preview-box">
            <ProgressDots activeStep={activeStep} />
            <div className="step-picker-row">
              {([0, 1, 2, 3] as const).map((step) => (
                <button
                  key={step}
                  type="button"
                  onClick={() => setActiveStep(step)}
                  className={`step-tab-btn ${activeStep === step ? "active" : ""}`}
                >
                  Step {step + 1}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* 2. Primary Button */}
        <section className="showcase-card">
          <div className="component-meta">
            <span className="comp-number">02</span>
            <div className="comp-title-wrap">
              <h3>Primary Button</h3>
              <p>
                64px tall, 16px radius, bold 20px label, #0E7C86 teal, high contrast
              </p>
            </div>
          </div>
          <div className="comp-preview-box">
            <PrimaryButton
              onClick={() => triggerFeedback("Primary Button clicked")}
            >
              I agree, let’s begin
            </PrimaryButton>
          </div>
        </section>

        {/* 3. Secondary Button */}
        <section className="showcase-card">
          <div className="component-meta">
            <span className="comp-number">03</span>
            <div className="comp-title-wrap">
              <h3>Secondary Button</h3>
              <p>64px tall, 16px radius, bold 20px, high contrast outline</p>
            </div>
          </div>
          <div className="comp-preview-box">
            <SecondaryButton
              icon="mic"
              onClick={() => triggerFeedback("Secondary Button clicked")}
            >
              No, say again
            </SecondaryButton>
          </div>
        </section>

        {/* 4. Question Card */}
        <section className="showcase-card">
          <div className="component-meta">
            <span className="comp-number">04</span>
            <div className="comp-title-wrap">
              <h3>Question Card</h3>
              <p>
                30px bold question, audio speaker, speak slower toggle (0.7x)
              </p>
            </div>
          </div>
          <div className="comp-preview-box">
            <QuestionCard
              question="What is your full name?"
              chipText="Question 3 of 12"
              subtitle="Please tell me"
              slowMode={slowMode}
              onToggleSlow={() => setSlowMode(!slowMode)}
              onListenAgain={() =>
                speakText("What is your full name?", "en-IN", slowMode)
              }
            />
          </div>
        </section>

        {/* 5. Answer Confirm Card */}
        <section className="showcase-card">
          <div className="component-meta">
            <span className="comp-number">05</span>
            <div className="comp-title-wrap">
              <h3>Answer Confirm Card</h3>
              <p>
                Detected voice text confirmation with green & outlined buttons
              </p>
            </div>
          </div>
          <div className="comp-preview-box">
            <AnswerConfirmCard
              title="Did I hear this right?"
              answer="Ramesh Kumar Shetty"
              onConfirm={() => triggerFeedback("Confirmed: Ramesh Kumar Shetty")}
              onReject={() => triggerFeedback("Rejected: Asking to repeat")}
              onTypeInstead={() => triggerFeedback("Switched to typing mode")}
            />
          </div>
        </section>

        {/* 6. Warning Banner */}
        <section className="showcase-card">
          <div className="component-meta">
            <span className="comp-number">06</span>
            <div className="comp-title-wrap">
              <h3>Warning Banner</h3>
              <p>Soft amber tone #E8A317, rounded icon, reassuring message</p>
            </div>
          </div>
          <div className="comp-preview-box">
            <WarningBanner
              message="Please never share your OTP or PIN with anyone, not even with us. We did not save it."
              icon="shield"
              variant="amber"
            />
          </div>
        </section>

        {/* 7. Checklist Row */}
        <section className="showcase-card">
          <div className="component-meta">
            <span className="comp-number">07</span>
            <div className="comp-title-wrap">
              <h3>Checklist Row</h3>
              <p>Touch targets ≥ 56px, high legibility, status pill badges</p>
            </div>
          </div>
          <div className="comp-preview-box">
            <div className="checklist-stack">
              <ChecklistRow
                label="Name matches"
                isComplete={true}
                statusBadge="✓ Verified"
              />
              <ChecklistRow
                label="Nominee details"
                isComplete={false}
                statusBadge="1 left"
              />
            </div>
          </div>
        </section>

        {/* 8. Language Card */}
        <section className="showcase-card">
          <div className="component-meta">
            <span className="comp-number">08</span>
            <div className="comp-title-wrap">
              <h3>Language Card</h3>
              <p>Native script title, English subtext, speak aloud icon</p>
            </div>
          </div>
          <div className="comp-preview-box">
            <div className="lang-cards-pair">
              <LanguageCard
                scriptName="हिन्दी"
                englishName="Hindi"
                isSelected={selectedLang === "हिन्दी"}
                onSelect={() => setSelectedLang("हिन्दी")}
                onSpeak={() => speakText("हिन्दी", "hi-IN")}
              />
              <LanguageCard
                scriptName="ಕನ್ನಡ"
                englishName="Kannada"
                isSelected={selectedLang === "ಕನ್ನಡ"}
                onSelect={() => setSelectedLang("ಕನ್ನಡ")}
                onSpeak={() => speakText("ಕನ್ನಡ", "kn-IN")}
              />
            </div>
          </div>
        </section>

        {/* 9. Bottom Help Bar */}
        <section className="showcase-card">
          <div className="component-meta">
            <span className="comp-number">09</span>
            <div className="comp-title-wrap">
              <h3>Bottom Help Bar</h3>
              <p>Present on all 8 screens, 56px touch target, human link</p>
            </div>
          </div>
          <div className="comp-preview-box">
            <BottomHelpBar onHelpClick={onOpenHelp} />
          </div>
        </section>
      </div>
    </div>
  );
}

export default ComponentShowcase;
