import { useState } from "react";
import { Icon } from "../Icons";
import {
  PrimaryButton,
  ProgressDots,
  BottomHelpBar,
} from "../UIComponents";
import { speakText } from "../../utils/speech";

export function Screen4Camera({
  onNext,
  onBack,
  onOpenHelp,
}: {
  onNext: () => void;
  onBack: () => void;
  onOpenHelp: () => void;
}) {
  const [photoTaken, setPhotoTaken] = useState(false);
  const [isBlurryToast, setIsBlurryToast] = useState(false);

  const handleCapture = () => {
    setPhotoTaken(true);
    speakText("Photo captured. Checking clarity...", "en-IN");
  };

  const handleToggleBlurryToast = () => {
    setIsBlurryToast(!isBlurryToast);
    if (!isBlurryToast) {
      speakText("Photo is blurry, please try again holding steady.", "en-IN");
    }
  };

  return (
    <div className="screen-container camera-screen-wrapper">
      {/* Top Progress indicator (Step 2: Check) */}
      <ProgressDots activeStep={1} />

      {/* Top bar with back button */}
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

        {/* State variant toggle for the Blurry Toast */}
        <button
          type="button"
          onClick={handleToggleBlurryToast}
          className={`variant-toggle-btn ${isBlurryToast ? "active" : ""}`}
          title="Toggle blurry warning toast variant"
        >
          <Icon name="alert" size={16} />
          <span>{isBlurryToast ? "Clear Photo State" : "Test Blurry Warning"}</span>
        </button>
      </div>

      {/* Screen Heading */}
      <div className="page-heading-block">
        <span className="section-eyebrow">Document 1 of 3</span>
        <h1 className="screen-main-heading">Take a photo of your Aadhaar card</h1>
      </div>

      {/* Camera Viewfinder */}
      <div className="camera-viewfinder-frame">
        {/* 4 Corner Guide Marks */}
        <div className="viewfinder-corner corner-top-left" />
        <div className="viewfinder-corner corner-top-right" />
        <div className="viewfinder-corner corner-bottom-left" />
        <div className="viewfinder-corner corner-bottom-right" />

        {/* Simulated Document inside guide */}
        <div className={`aadhaar-card-preview ${photoTaken ? "captured" : ""}`}>
          <div className="aadhaar-header-emblem">
            <span className="emblem-sutra">स</span>
            <div className="emblem-text">
              <span className="gov-title">Government of India</span>
              <span className="uid-title">भारत सरकार</span>
            </div>
          </div>
          <div className="aadhaar-body-layout">
            <div className="aadhaar-avatar-box">
              <Icon name="user" size={32} />
            </div>
            <div className="aadhaar-details-lines">
              <div className="line-name">Ramesh Shetty</div>
              <div className="line-sub">DOB: 14/08/1958</div>
              <div className="line-sub">Male / पुरुष</div>
            </div>
          </div>
          <div className="aadhaar-uid-number">
            4812 · 9021 · 4271
          </div>
        </div>

        {/* Camera scanning line effect */}
        {!photoTaken && <div className="camera-scan-laser-line" />}

        {/* "Photo is blurry, try again" amber toast variant */}
        {isBlurryToast && (
          <div className="blurry-toast-alert" role="status">
            <div className="toast-icon-circle">
              <Icon name="alert" size={20} />
            </div>
            <div className="toast-text-wrap">
              <strong>Photo is blurry, try again</strong>
              <span>Hold steady and ensure good room light.</span>
            </div>
            <button
              type="button"
              onClick={() => setIsBlurryToast(false)}
              className="toast-dismiss-btn"
              aria-label="Dismiss alert"
            >
              <Icon name="close" size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Instruction text directly under the viewfinder box */}
      <p className="viewfinder-instruction-text">
        Place the card inside the box. Hold steady.
      </p>

      {/* Checklist chips showing completed ones */}
      <div className="doc-checklist-chips">
        <span className="doc-chip chip-done">
          <Icon name="check" size={16} /> Aadhaar
        </span>
        <span className="doc-chip chip-pending">
          PAN
        </span>
        <span className="doc-chip chip-pending">
          Passbook
        </span>
      </div>

      {/* Large Round Shutter Button */}
      <div className="shutter-control-center">
        <button
          type="button"
          onClick={handleCapture}
          className="large-round-shutter-btn"
          aria-label="Capture photo"
        >
          <div className="shutter-inner-ring">
            <Icon name="camera" size={32} />
          </div>
        </button>
        <span className="shutter-helper-label">
          {photoTaken ? "Tap to retake" : "Tap to capture"}
        </span>
      </div>

      {/* Primary Action Button */}
      <div className="screen-bottom-action">
        <PrimaryButton onClick={onNext}>
          Use this photo
        </PrimaryButton>
      </div>

      {/* Bottom Help Link */}
      <BottomHelpBar onHelpClick={onOpenHelp} />
    </div>
  );
}

export default Screen4Camera;
