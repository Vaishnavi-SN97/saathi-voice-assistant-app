import { useState } from "react";
import { Icon } from "../Icons";
import {
  PrimaryButton,
  ProgressDots,
  BottomHelpBar,
} from "../UIComponents";
import { speakText } from "../../utils/speech";

export function Screen5Problems({
  onNext,
  onBack,
  onOpenHelp,
}: {
  onNext: () => void;
  onBack: () => void;
  onOpenHelp: () => void;
}) {
  const [selectedNameVersion, setSelectedNameVersion] = useState<string>("Ramesh Kumar Shetty");
  const [showNamePicker, setShowNamePicker] = useState(false);
  const [passbookRetaken, setPassbookRetaken] = useState(false);

  const card1Text =
    "Your name is spelled two ways: Ramesh Shetty on Aadhaar and Ramesh K Shetty on PAN. Which is correct?";
  const card2Text =
    "Your passbook photo is blurry. Please retake photo with clear text.";

  return (
    <div className="screen-container problems-screen-wrapper">
      {/* Top Progress indicator (Step 2: Check) */}
      <ProgressDots activeStep={1} />

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

        <div className="calm-chip-indicator">
          <span>Almost ready</span>
        </div>
      </div>

      {/* Friendly, Not Alarming Heading */}
      <div className="page-heading-block">
        <span className="section-eyebrow">Quick check</span>
        <h1 className="screen-main-heading">
          Let’s fix 2 small things before you go to the bank
        </h1>
      </div>

      {/* Issues List with Amber Left Borders */}
      <div className="issues-cards-container">
        {/* Card (a): Name discrepancy */}
        <div className="issue-card-amber-border">
          <div className="issue-card-header">
            <div className="issue-title-group">
              <span className="issue-amber-dot">!</span>
              <h2 className="issue-card-title">
                Your name is spelled two ways:
              </h2>
            </div>
            <button
              type="button"
              onClick={() => speakText(card1Text, "en-IN")}
              className="mini-speaker-btn"
              aria-label="Read this name issue aloud"
            >
              <Icon name="speaker" size={22} />
            </button>
          </div>

          <p className="issue-description-copy">
            “Ramesh Shetty” on Aadhaar and “Ramesh K Shetty” on PAN.
          </p>

          {/* Mini Side-by-side Image of the Two Documents */}
          <div className="mini-docs-side-by-side">
            <div className="mini-doc-item aadhaar-mini">
              <div className="mini-doc-tag">Aadhaar</div>
              <div className="mini-doc-name-preview">Ramesh Shetty</div>
              <div className="mini-doc-footer-number">•• 4271</div>
            </div>
            <div className="mini-doc-item pan-mini">
              <div className="mini-doc-tag">PAN Card</div>
              <div className="mini-doc-name-preview">Ramesh K Shetty</div>
              <div className="mini-doc-footer-number">•• 891B</div>
            </div>
          </div>

          {/* Interactive Button: Which is correct? */}
          <div className="issue-action-box">
            <button
              type="button"
              onClick={() => setShowNamePicker(!showNamePicker)}
              className="issue-selector-button"
            >
              <span className="selector-text">
                Which is correct? ({selectedNameVersion})
              </span>
              <Icon name="chevron" size={20} />
            </button>

            {showNamePicker && (
              <div className="name-options-dropdown">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedNameVersion("Ramesh Shetty (as on Aadhaar)");
                    setShowNamePicker(false);
                    speakText("Selected Ramesh Shetty as on Aadhaar", "en-IN");
                  }}
                  className={`name-option-btn ${
                    selectedNameVersion.includes("Aadhaar") ? "active" : ""
                  }`}
                >
                  <Icon name="check" size={18} />
                  <span>Ramesh Shetty (Use Aadhaar spelling)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedNameVersion("Ramesh K Shetty (as on PAN)");
                    setShowNamePicker(false);
                    speakText("Selected Ramesh K Shetty as on PAN", "en-IN");
                  }}
                  className={`name-option-btn ${
                    selectedNameVersion.includes("PAN") ? "active" : ""
                  }`}
                >
                  <Icon name="check" size={18} />
                  <span>Ramesh K Shetty (Use PAN spelling)</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Card (b): Blurry Passbook */}
        <div className="issue-card-amber-border">
          <div className="issue-card-header">
            <div className="issue-title-group">
              <span className="issue-amber-dot">!</span>
              <h2 className="issue-card-title">
                Your passbook photo is blurry
              </h2>
            </div>
            <button
              type="button"
              onClick={() => speakText(card2Text, "en-IN")}
              className="mini-speaker-btn"
              aria-label="Read passbook issue aloud"
            >
              <Icon name="speaker" size={22} />
            </button>
          </div>

          <p className="issue-description-copy">
            {passbookRetaken
              ? "Passbook photo updated successfully! Account number is now sharp and clear."
              : "We need one clear photo to read your account number and IFSC code accurately."}
          </p>

          <div className="issue-action-box">
            <button
              type="button"
              onClick={() => {
                setPassbookRetaken(true);
                speakText("Passbook retaken and verified clear.", "en-IN");
              }}
              className={`issue-selector-button ${
                passbookRetaken ? "button-resolved" : ""
              }`}
            >
              <Icon name={passbookRetaken ? "check" : "camera"} size={20} />
              <span>{passbookRetaken ? "Retaken ✓ Clear" : "Retake photo"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Reassuring Line */}
      <div className="reassurance-green-strip">
        <div className="reassurance-icon-badge">
          <Icon name="check" size={20} />
        </div>
        <p className="reassurance-copy-text">
          Finding this now saves you a second trip.
        </p>
      </div>

      {/* Primary Action */}
      <div className="screen-bottom-action">
        <PrimaryButton onClick={onNext}>
          Continue to readiness check
        </PrimaryButton>
      </div>

      {/* Bottom Help Link */}
      <BottomHelpBar onHelpClick={onOpenHelp} />
    </div>
  );
}

export default Screen5Problems;
