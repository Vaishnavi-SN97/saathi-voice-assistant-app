// Static design preview of the status screen (used by the Hindi comparison frame). The live screen is Screen7Status.tsx.
import { useState } from "react";
import { Icon } from "../Icons";
import {
  PrimaryButton,
  ProgressDots,
  BottomHelpBar,
} from "../UIComponents";
import { speakText } from "../../utils/speech";

export function Screen7StatusStatic({
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
  const [familyShare, setFamilyShare] = useState(true);

  const timelineStepsEn = [
    { title: "Application sent", time: "Today, 10:30 AM", state: "done" },
    { title: "Documents checked", time: "Today, 10:32 AM", state: "done" },
    {
      title: "Bank officer review",
      time: "In progress now",
      state: "current",
    },
    { title: "Approved", time: "Next", state: "future" },
    { title: "Visit the branch to sign", time: "Final step", state: "future" },
  ];

  const timelineStepsHi = [
    { title: "आवेदन भेजा गया", time: "आज, 10:30 पूर्वाह्न", state: "done" },
    { title: "दस्तावेज़ जाँचे गए", time: "आज, 10:32 पूर्वाह्न", state: "done" },
    {
      title: "बैंक अधिकारी समीक्षा",
      time: "वर्तमान में जारी है...",
      state: "current",
    },
    { title: "स्वीकृत (Approved)", time: "अगला चरण", state: "future" },
    { title: "हस्ताक्षर हेतु शाखा पधारें", time: "अंतिम कदम", state: "future" },
  ];

  const timelineSteps = isHindi ? timelineStepsHi : timelineStepsEn;

  const handleListenStatus = () => {
    const text = isHindi
      ? "आवेदन की स्थिति। आपका फॉर्म पूर्व-स्वीकृत है। बैंक अधिकारी समीक्षा कर रहे हैं। हस्ताक्षर के लिए मणिपाल को-ऑपरेटिव बैंक, उडुपी मुख्य शाखा पधारें।"
      : "Application status. Your application is pre-approved. Bank officer review is in progress. Visit Manipal Co-operative Bank, Udupi Main Branch to sign.";
    speakText(text, isHindi ? "hi-IN" : "en-IN");
  };

  return (
    <div className="screen-container status-screen-wrapper">
      {/* Top Progress indicator (Step 3: Review) */}
      <ProgressDots activeStep={2} />

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
          onClick={handleListenStatus}
          className="listen-pill-btn"
          aria-label="Listen to status aloud"
        >
          <Icon name="speaker" size={22} />
          <span>Listen</span>
        </button>
      </div>

      {/* Screen Heading */}
      <div className="page-heading-block">
        <span className="section-eyebrow">
          {isHindi ? "आवेदन संख्या #SAA-2026-0417" : "Application #SAA-2026-0417"}
        </span>
        <h1 className="screen-main-heading">
          {isHindi ? "हम आपको सूचित रखेंगे" : "We’ll keep you updated"}
        </h1>
      </div>

      {/* Prominent Pre-Approved Card */}
      <div className="prominent-preapproved-card">
        <div className="preapproved-header">
          <div className="preapproved-seal-icon">
            <Icon name="shield" size={28} />
          </div>
          <div className="preapproved-titles">
            <span className="preapproved-tag">
              {isHindi ? "अच्छी खबर" : "Good news"}
            </span>
            <strong className="preapproved-headline">
              {isHindi ? "पूर्व-स्वीकृत (Pre-approved)" : "Pre-approved."}
            </strong>
          </div>
        </div>

        <p className="preapproved-instruction">
          {isHindi
            ? "हस्ताक्षर के लिए शाखा में पधारें।"
            : "Visit the branch to sign."}
        </p>

        {/* Branch Name with Map Pin */}
        <div className="branch-location-strip">
          <div className="pin-circle">
            <Icon name="location" size={22} />
          </div>
          <div className="branch-name-info">
            <span className="branch-label">
              {isHindi ? "निर्धारित शाखा" : "Assigned Branch"}
            </span>
            <strong className="branch-title-text">
              Manipal Co-operative Bank, Udupi Main Branch
            </strong>
          </div>
        </div>
      </div>

      {/* Vertical Timeline with 5 Steps */}
      <div className="vertical-timeline-card">
        <div className="timeline-items-flow">
          {timelineSteps.map((step, index) => {
            const isDone = step.state === "done";
            const isCurrent = step.state === "current";
            return (
              <div
                key={index}
                className={`timeline-step-row ${
                  isDone ? "step-finished" : isCurrent ? "step-active" : "step-pending"
                }`}
              >
                {/* Timeline line connector */}
                {index < timelineSteps.length - 1 && (
                  <div
                    className={`timeline-vertical-wire ${
                      isDone ? "wire-filled" : ""
                    }`}
                  />
                )}

                {/* Marker icon */}
                <div className="timeline-node-marker">
                  {isDone ? (
                    <Icon name="check" size={14} />
                  ) : isCurrent ? (
                    <span className="current-pulse-dot" />
                  ) : (
                    <span className="future-empty-dot" />
                  )}
                </div>

                {/* Text details */}
                <div className="timeline-node-content">
                  <strong className="timeline-node-title">
                    {step.title}
                  </strong>
                  <span className="timeline-node-time">
                    {step.time}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* WhatsApp update reassurance line */}
      <div className="whatsapp-notice-strip">
        <div className="whatsapp-icon-circle">
          <Icon name="whatsapp" size={22} />
        </div>
        <p className="whatsapp-text">
          {isHindi
            ? "हम आपको आपकी भाषा में व्हाट्सएप पर अपडेट भेजेंगे।"
            : "We will update you on WhatsApp in your language."}
        </p>
      </div>

      {/* Family-share toggle: Let my son or daughter follow this */}
      <div className="family-share-card">
        <div className="family-info-group">
          <div className="family-icon-box">
            <Icon name="user" size={22} />
          </div>
          <div className="family-copy">
            <strong>
              {isHindi
                ? "मेरे बेटे या बेटी को यह देखने दें"
                : "Let my son or daughter follow this"}
            </strong>
            <span>
              {isHindi
                ? "उन्हें एसएमएस या व्हाट्सएप पर सूचना मिलेगी"
                : "They will receive SMS updates so they can assist you"}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            const nextShare = !familyShare;
            setFamilyShare(nextShare);
            speakText(
              nextShare
                ? "Family share enabled."
                : "Family share turned off.",
              "en-IN"
            );
          }}
          className={`family-toggle-switch ${familyShare ? "active" : ""}`}
          aria-pressed={familyShare}
        >
          <span className="toggle-slider-knob" />
        </button>
      </div>

      {/* Primary Action Button */}
      <div className="screen-bottom-action">
        <PrimaryButton onClick={onNext}>
          {isHindi ? "फास्ट काउंटर क्यूआर कोड देखें" : "View fast counter QR code"}
        </PrimaryButton>
      </div>

      {/* Bottom Help Link */}
      <BottomHelpBar onHelpClick={onOpenHelp} />
    </div>
  );
}

export default Screen7StatusStatic;
