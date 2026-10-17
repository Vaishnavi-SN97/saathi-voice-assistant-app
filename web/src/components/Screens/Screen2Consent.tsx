import { useState } from "react";
import { Icon } from "../Icons";
import {
  PrimaryButton,
  ProgressDots,
  BottomHelpBar,
} from "../UIComponents";
import { speakText } from "../../utils/speech";

export function Screen2Consent({
  onNext,
  onBack,
  onOpenHelp,
}: {
  onNext: () => void;
  onBack: () => void;
  onOpenHelp: () => void;
}) {
  const [showModal, setShowModal] = useState(false);

  const consentPoints = [
    {
      icon: "mic" as const,
      text: "We will listen to you and read your documents to fill your bank form.",
    },
    {
      icon: "lock" as const,
      text: "We will never ask for your OTP or PIN.",
      highlight: true,
    },
    {
      icon: "shield" as const,
      text: "A bank officer checks everything before it is final.",
    },
  ];

  const handleListenScreen = () => {
    speakText(
      "Before we start. We will listen to you and read your documents to fill your bank form. We will never ask for your OTP or PIN. A bank officer checks everything before it is final. Your data stays private.",
      "en-IN"
    );
  };

  return (
    <div className="screen-container">
      {/* Top Progress indicator */}
      <ProgressDots activeStep={0} />

      {/* Top bar with back and listen button */}
      <div className="top-action-bar">
        <button
          type="button"
          onClick={onBack}
          className="nav-back-btn"
          aria-label="Go back to language picker"
        >
          <Icon name="chevron" size={24} className="rotate-180" />
          <span>Back</span>
        </button>

        <button
          type="button"
          onClick={handleListenScreen}
          className="listen-pill-btn"
          aria-label="Listen to this page aloud"
        >
          <Icon name="speaker" size={22} />
          <span>Listen to this</span>
        </button>
      </div>

      {/* Screen Heading */}
      <div className="page-heading-block">
        <span className="section-eyebrow">Your Safety First</span>
        <h1 className="screen-main-heading">Before we start</h1>
      </div>

      {/* 3 Privacy Lines with friendly rounded icons */}
      <div className="consent-points-list">
        {consentPoints.map((item, index) => (
          <div
            key={index}
            className={`consent-point-card ${
              item.highlight ? "highlight-point" : ""
            }`}
          >
            <div className="consent-icon-circle">
              <Icon name={item.icon} size={26} />
            </div>
            <p className="consent-text">{item.text}</p>
          </div>
        ))}
      </div>

      {/* Teal shield badge */}
      <div className="teal-shield-badge">
        <div className="shield-icon-badge">
          <Icon name="shield" size={32} />
        </div>
        <div className="shield-badge-copy">
          <strong className="badge-title">Your data stays private.</strong>
          <span className="badge-subtitle">
            Protected and only shared with your bank.
          </span>
        </div>
      </div>

      {/* Actions: Primary button + secondary text button */}
      <div className="screen-bottom-action">
        <PrimaryButton onClick={onNext}>I agree, let’s begin</PrimaryButton>

        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="read-more-text-btn"
        >
          Read more about privacy & safety
        </button>
      </div>

      {/* Bottom Help Link */}
      <BottomHelpBar onHelpClick={onOpenHelp} />

      {/* Read More Modal */}
      {showModal && (
        <div className="app-modal-overlay" role="dialog" aria-modal="true">
          <div className="app-modal-card">
            <div className="modal-header">
              <div className="modal-icon-badge">
                <Icon name="shield" size={28} />
              </div>
              <h3 className="modal-title">Our Senior Safety Promise</h3>
            </div>
            <div className="modal-body-content">
              <p>
                <strong>1. Zero Fraud Risk:</strong> Saathi will never ask for your
                card CVV, ATM PIN, internet banking password, or phone SMS OTP.
              </p>
              <p>
                <strong>2. Human Verification:</strong> Your application is not
                completed automatically. A certified branch officer reviews
                your submission in person.
              </p>
              <p>
                <strong>3. Voice Consent:</strong> You have full control at all
                times. You can cancel or pause whenever you wish.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="modal-close-primary-btn"
            >
              I Understand
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Screen2Consent;
