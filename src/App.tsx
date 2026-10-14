import { useState } from "react";
import { Screen1Language } from "./components/Screens/Screen1Language";
import { Screen2Consent } from "./components/Screens/Screen2Consent";
import { Screen3Voice } from "./components/Screens/Screen3Voice";
import { Screen4Camera } from "./components/Screens/Screen4Camera";
import { Screen5Problems } from "./components/Screens/Screen5Problems";
import { Screen6Score } from "./components/Screens/Screen6Score";
import { Screen7Status } from "./components/Screens/Screen7Status";
import { Screen8QR } from "./components/Screens/Screen8QR";
import { HindiFrames } from "./components/HindiFrames";
import { ComponentShowcase } from "./components/ComponentShowcase";
import { Icon } from "./components/Icons";
import { speakText } from "./utils/speech";

export function App() {
  // Navigation: screens 1 to 8 (0-indexed: 0..7)
  const [currentScreenIndex, setCurrentScreenIndex] = useState(0);

  // View Mode: 'prototype' | 'hindi-comparison' | 'components'
  const [viewMode, setViewMode] = useState<
    "prototype" | "hindi-comparison" | "components"
  >("prototype");

  // Selected language
  const [appLanguage, setAppLanguage] = useState("हिन्दी");

  // Help modal state
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Navigation handlers
  const goToNext = () => {
    setCurrentScreenIndex((prev) => Math.min(7, prev + 1));
  };

  const goToBack = () => {
    setCurrentScreenIndex((prev) => Math.max(0, prev - 1));
  };

  const goToScreen = (index: number) => {
    setCurrentScreenIndex(index);
  };

  const handleRestart = () => {
    setCurrentScreenIndex(0);
    speakText("Welcome back to Saathi.", "en-IN");
  };

  const handleOpenHelp = () => {
    setShowHelpModal(true);
    speakText(
      "A banking officer is available to talk to you. You can call directly or request a callback.",
      "en-IN"
    );
  };

  // Screens Array
  const screens = [
    <Screen1Language
      key="screen-1"
      onNext={(lang) => {
        setAppLanguage(lang);
        goToNext();
      }}
      onOpenHelp={handleOpenHelp}
    />,
    <Screen2Consent
      key="screen-2"
      onNext={goToNext}
      onBack={goToBack}
      onOpenHelp={handleOpenHelp}
    />,
    <Screen3Voice
      key="screen-3"
      onNext={goToNext}
      onBack={goToBack}
      onOpenHelp={handleOpenHelp}
      isHindi={appLanguage === "हिन्दी"}
    />,
    <Screen4Camera
      key="screen-4"
      onNext={goToNext}
      onBack={goToBack}
      onOpenHelp={handleOpenHelp}
    />,
    <Screen5Problems
      key="screen-5"
      onNext={goToNext}
      onBack={goToBack}
      onOpenHelp={handleOpenHelp}
    />,
    <Screen6Score
      key="screen-6"
      onNext={goToNext}
      onBack={goToBack}
      onOpenHelp={handleOpenHelp}
    />,
    <Screen7Status
      key="screen-7"
      onNext={goToNext}
      onBack={goToBack}
      onOpenHelp={handleOpenHelp}
      isHindi={appLanguage === "हिन्दी"}
    />,
    <Screen8QR
      key="screen-8"
      onRestart={handleRestart}
      onBack={goToBack}
      onOpenHelp={handleOpenHelp}
    />,
  ];

  const screenNames = [
    "1. Language",
    "2. Consent",
    "3. Voice Interview",
    "4. Camera",
    "5. Problems",
    "6. Readiness",
    "7. Status",
    "8. QR Fast Pass",
  ];

  return (
    <div className="main-viewport-container">
      {/* Top Application Bar with Navigation Modes */}
      <header className="global-app-header">
        <div className="header-brand-block">
          <div className="header-logo-icon">
            <img src="/saathi-logo.png" alt="Saathi Logo" />
          </div>
          <div className="header-brand-text">
            <h1 className="header-title">
              साथी <span className="header-sub">Saathi</span>
            </h1>
            <span className="header-tagline">
              Senior-First Voice Banking Assistant
            </span>
          </div>
        </div>

        {/* View Mode Tabs */}
        <nav className="header-view-tabs" aria-label="View Switcher">
          <button
            type="button"
            onClick={() => setViewMode("prototype")}
            className={`tab-switch-btn ${
              viewMode === "prototype" ? "active" : ""
            }`}
          >
            <Icon name="phone" size={18} />
            <span>8 Connected Screens</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode("hindi-comparison")}
            className={`tab-switch-btn ${
              viewMode === "hindi-comparison" ? "active" : ""
            }`}
          >
            <Icon name="check" size={18} />
            <span>Hindi Dual Frame (Screens 3 & 7)</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode("components")}
            className={`tab-switch-btn ${
              viewMode === "components" ? "active" : ""
            }`}
          >
            <Icon name="document" size={18} />
            <span>Component Set</span>
          </button>
        </nav>
      </header>

      {/* Main Content Area */}
      <main className="main-content-layout">
        {viewMode === "prototype" && (
          <div className="prototype-interactive-stage">
            {/* Quick Screen Selector Toolbar */}
            <div className="screen-selector-toolbar" aria-label="Screen Quick Jump">
              <span className="toolbar-label">
                Screen {currentScreenIndex + 1} of 8:
              </span>
              <div className="screen-pill-buttons">
                {screenNames.map((name, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => goToScreen(idx)}
                    className={`screen-pill-btn ${
                      currentScreenIndex === idx ? "active" : ""
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>

            {/* iPhone 14 Device Canvas (390 x 844) */}
            <div className="iphone-canvas-container">
              <div
                className="iphone-14-mockup-frame"
                id="iphone-14-viewport"
                tabIndex={0}
                aria-label="iPhone 14 Canvas: 390 by 844"
              >
                {/* iPhone Hardware Elements */}
                <div className="iphone-dynamic-island" />
                <div className="iphone-status-bar">
                  <span className="status-clock">10:30</span>
                  <div className="status-system-indicators">
                    <span className="signal-bars">●●●●</span>
                    <span className="wifi-icon">5G</span>
                    <span className="battery-badge">100%</span>
                  </div>
                </div>

                {/* Render Connected Screen */}
                <div className="screen-display-viewport">
                  {screens[currentScreenIndex]}
                </div>

                {/* Home Indicator Bar */}
                <div className="iphone-home-indicator" />
              </div>

              {/* Bottom Interactive Flow Links Bar */}
              <div
                className="prototype-quick-stepper"
                aria-label="Screen flow links"
              >
                <button
                  type="button"
                  onClick={goToBack}
                  disabled={currentScreenIndex === 0}
                  className="step-nav-btn prev-btn"
                >
                  <Icon name="chevron" size={20} className="rotate-180" />
                  <span>Previous</span>
                </button>

                <div className="stepper-dots-indicator">
                  {screens.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => goToScreen(i)}
                      className={`stepper-dot ${
                        currentScreenIndex === i ? "active" : ""
                      }`}
                      aria-label={`Jump to Screen ${i + 1}`}
                    ></button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={
                    currentScreenIndex === 7 ? handleRestart : goToNext
                  }
                  className="step-nav-btn next-btn"
                >
                  <span>
                    {currentScreenIndex === 7 ? "Restart" : "Next Screen"}
                  </span>
                  <Icon name="chevron" size={20} />
                </button>
              </div>
            </div>
          </div>
        )}

        {viewMode === "hindi-comparison" && (
          <HindiFrames onOpenHelp={handleOpenHelp} />
        )}

        {viewMode === "components" && (
          <ComponentShowcase onOpenHelp={handleOpenHelp} />
        )}
      </main>

      {/* Senior Help Modal: "Help / talk to a person" */}
      {showHelpModal && (
        <div
          className="app-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="help-modal-heading"
        >
          <div className="app-modal-card senior-help-card">
            <div className="modal-header">
              <div className="modal-icon-badge help-badge">
                <Icon name="headset" size={28} />
              </div>
              <h3 id="help-modal-heading" className="modal-title">
                Talk to a Bank Officer
              </h3>
            </div>

            <div className="modal-body-content">
              <p className="help-friendly-line">
                Do not worry, Ramesh ji. You do not need to do this alone.
                Our friendly branch assistant is here to guide you.
              </p>

              <div className="help-options-stack">
                <a
                  href="tel:18004252841"
                  className="help-call-direct-btn"
                  onClick={() =>
                    speakText("Connecting you to toll free bank assistance.", "en-IN")
                  }
                >
                  <Icon name="phone" size={24} />
                  <div className="call-info">
                    <strong>Call Toll-Free: 1800-425-2841</strong>
                    <span>Available in Kannada, Hindi, English</span>
                  </div>
                </a>

                <button
                  type="button"
                  onClick={() => {
                    setShowHelpModal(false);
                    speakText(
                      "Request received. An officer from Udupi branch will call your phone in 5 minutes.",
                      "en-IN"
                    );
                  }}
                  className="help-callback-btn"
                >
                  <Icon name="whatsapp" size={24} />
                  <div className="call-info">
                    <strong>Request a Call Back</strong>
                    <span>An officer will call you in 5 minutes</span>
                  </div>
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowHelpModal(false)}
              className="modal-close-primary-btn"
            >
              Back to form
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
