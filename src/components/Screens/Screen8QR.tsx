import { useState } from "react";
import { Icon } from "../Icons";
import {
  PrimaryButton,
  SecondaryButton,
  ProgressDots,
  BottomHelpBar,
} from "../UIComponents";
import { speakText } from "../../utils/speech";

export function Screen8QR({
  onRestart,
  onBack,
  onOpenHelp,
}: {
  onRestart: () => void;
  onBack: () => void;
  onOpenHelp: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [addedToPhone, setAddedToPhone] = useState(false);

  const handleCopyCode = () => {
    navigator.clipboard?.writeText("SAA-2026-0417");
    setCopied(true);
    speakText("Application number copied.", "en-IN");
    setTimeout(() => setCopied(false), 2500);
  };

  const handleAddToPhone = () => {
    setAddedToPhone(true);
    speakText("Fast counter QR pass saved to your phone photos.", "en-IN");
  };

  const handleCallBranch = () => {
    speakText("Connecting you to Udupi main branch manager.", "en-IN");
    window.location.href = "tel:+918202520111";
  };

  return (
    <div className="screen-container qr-screen-wrapper">
      {/* Top Progress indicator (Step 4: Sign) */}
      <ProgressDots activeStep={3} />

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

        <button
          type="button"
          onClick={() =>
            speakText(
              "Show this at the fast counter. Application number SAA-2026-0417. No waiting in the general queue. Please carry your original Aadhaar, original PAN, and passbook.",
              "en-IN"
            )
          }
          className="listen-pill-btn"
          aria-label="Listen aloud"
        >
          <Icon name="speaker" size={22} />
          <span>Listen</span>
        </button>
      </div>

      {/* Screen Heading */}
      <div className="page-heading-block">
        <span className="section-eyebrow">Priority Fast Counter</span>
        <h1 className="screen-main-heading">Show this at the fast counter</h1>
      </div>

      {/* Huge QR Code in White Card with Teal Border */}
      <div className="huge-qr-card-container">
        <div className="qr-svg-holder">
          {/* Authentic High-Contrast Vector QR Code Pattern */}
          <svg
            className="qr-matrix-svg"
            viewBox="0 0 200 200"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-label="QR Code for Application SAA-2026-0417"
          >
            {/* Background */}
            <rect width="200" height="200" fill="#FFFFFF" rx="12" />

            {/* Position Detection Patterns (Top-Left, Top-Right, Bottom-Left) */}
            {/* Top-Left */}
            <rect x="16" y="16" width="48" height="48" rx="6" fill="#0E7C86" />
            <rect x="24" y="24" width="32" height="32" rx="4" fill="#FFFFFF" />
            <rect x="32" y="32" width="16" height="16" rx="3" fill="#0E7C86" />

            {/* Top-Right */}
            <rect x="136" y="16" width="48" height="48" rx="6" fill="#0E7C86" />
            <rect x="144" y="24" width="32" height="32" rx="4" fill="#FFFFFF" />
            <rect x="152" y="32" width="16" height="16" rx="3" fill="#0E7C86" />

            {/* Bottom-Left */}
            <rect x="16" y="136" width="48" height="48" rx="6" fill="#0E7C86" />
            <rect x="24" y="144" width="32" height="32" rx="4" fill="#FFFFFF" />
            <rect x="32" y="152" width="16" height="16" rx="3" fill="#0E7C86" />

            {/* Timing Patterns & Data Matrix Bits */}
            <path
              d="M72 24h8v8h-8zM88 24h8v8h-8zM104 24h8v8h-8zM120 24h8v8h-8zM72 40h8v8h-8zM104 40h8v8h-8zM72 56h8v8h-8zM88 56h8v8h-8zM120 56h8v8h-8z"
              fill="#1F3A5F"
            />
            <path
              d="M24 72h8v8h-8zM40 72h8v8h-8zM56 72h8v8h-8zM72 72h8v8h-8zM88 72h8v8h-8zM104 72h8v8h-8zM120 72h8v8h-8zM144 72h8v8h-8zM168 72h8v8h-8z"
              fill="#1F3A5F"
            />
            <path
              d="M24 88h8v8h-8zM48 88h8v8h-8zM72 88h8v8h-8zM120 88h8v8h-8zM152 88h8v8h-8zM168 88h8v8h-8z"
              fill="#0E7C86"
            />
            <path
              d="M24 104h8v8h-8zM56 104h8v8h-8zM88 104h8v8h-8zM104 104h8v8h-8zM136 104h8v8h-8zM168 104h8v8h-8z"
              fill="#1F3A5F"
            />
            <path
              d="M72 120h8v8h-8zM88 120h8v8h-8zM120 120h8v8h-8zM144 120h8v8h-8z"
              fill="#0E7C86"
            />
            <path
              d="M72 136h8v8h-8zM104 136h8v8h-8zM120 136h8v8h-8zM152 136h8v8h-8zM168 136h8v8h-8z"
              fill="#1F3A5F"
            />
            <path
              d="M88 152h8v8h-8zM104 152h8v8h-8zM136 152h8v8h-8zM160 152h8v8h-8z"
              fill="#1F3A5F"
            />
            <path
              d="M72 168h8v8h-8zM88 168h8v8h-8zM120 168h8v8h-8zM144 168h8v8h-8zM168 168h8v8h-8z"
              fill="#0E7C86"
            />

            {/* Center Brand Badge (Saathi Emblem) */}
            <circle cx="100" cy="100" r="20" fill="#FFFFFF" />
            <circle cx="100" cy="100" r="16" fill="#0E7C86" />
            <text
              x="100"
              y="105"
              fill="#FFFFFF"
              fontSize="14"
              fontWeight="bold"
              textAnchor="middle"
              dominantBaseline="middle"
            >
              स
            </text>
          </svg>
        </div>

        {/* Application Number with Copy Action */}
        <div className="application-number-strip">
          <span className="app-id-label">Application number</span>
          <div className="app-id-row">
            <strong className="app-id-text">SAA-2026-0417</strong>
            <button
              type="button"
              onClick={handleCopyCode}
              className="copy-chip-btn"
              aria-label="Copy application number"
            >
              <Icon name={copied ? "check" : "copy"} size={16} />
              <span>{copied ? "Copied" : "Copy"}</span>
            </button>
          </div>
        </div>

        {/* Reassuring Line: No waiting in the general queue */}
        <div className="fast-queue-badge">
          <Icon name="check" size={20} />
          <strong>No waiting in the general queue.</strong>
        </div>
      </div>

      {/* List of What to Carry Card */}
      <div className="what-to-carry-card">
        <h3 className="carry-title">Please carry to the branch:</h3>
        <div className="carry-items-list">
          <div className="carry-row">
            <div className="carry-icon-box">
              <Icon name="document" size={20} />
            </div>
            <span className="carry-text">
              <strong>Original Aadhaar</strong> card
            </span>
          </div>
          <div className="carry-row">
            <div className="carry-icon-box">
              <Icon name="document" size={20} />
            </div>
            <span className="carry-text">
              <strong>Original PAN</strong> card
            </span>
          </div>
          <div className="carry-row">
            <div className="carry-icon-box">
              <Icon name="document" size={20} />
            </div>
            <span className="carry-text">
              <strong>Bank Passbook</strong> (original)
            </span>
          </div>
        </div>
      </div>

      {/* Action Buttons: Add to my phone (Primary) + Call the branch (Secondary) */}
      <div className="screen-bottom-action">
        <PrimaryButton
          onClick={handleAddToPhone}
          icon={addedToPhone ? "check" : "arrow"}
        >
          {addedToPhone ? "Saved to Phone ✓" : "Add to my phone"}
        </PrimaryButton>

        <SecondaryButton
          onClick={handleCallBranch}
          icon="phone"
          variant="outline"
          className="mt-3"
        >
          Call the branch (0820-2520111)
        </SecondaryButton>

        <button
          type="button"
          onClick={onRestart}
          className="restart-flow-text-btn"
        >
          Start new form / Restart flow
        </button>
      </div>

      {/* Bottom Help Link */}
      <BottomHelpBar onHelpClick={onOpenHelp} />
    </div>
  );
}

export default Screen8QR;
