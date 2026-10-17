import { useEffect, useState, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { Screen1Language } from "./components/Screens/Screen1Language";
import { Screen2Consent } from "./components/Screens/Screen2Consent";
import { Screen3Voice } from "./components/Screens/Screen3Voice";
import { Screen4Camera } from "./components/Screens/Screen4Camera";
import { Screen5Problems } from "./components/Screens/Screen5Problems";
import { Screen6Score } from "./components/Screens/Screen6Score";
import { Screen7Status } from "./components/Screens/Screen7Status";
import { Screen8QR } from "./components/Screens/Screen8QR";
import { Screen9Done } from "./components/Screens/Screen9Done";
import { HindiFrames } from "./components/HindiFrames";
import { ComponentShowcase } from "./components/ComponentShowcase";
import { Icon } from "./components/Icons";
import { speakText } from "./utils/speech";
import { LANG_CODE, LanguageSwitcher, useI18n } from "./lib/i18n";
import { useSession } from "./lib/session";

/** The 8 customer screens, in order. */
const PATHS = ["/", "/consent", "/interview", "/camera", "/problems", "/readiness", "/status", "/qr"] as const;
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

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setMatches(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, [query]);
  return matches;
}

export function App() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { lang, t } = useI18n();
  const session = useSession();

  // Phones get the app full screen; wider screens keep the design-preview device frame.
  const isPhone = useMediaQuery("(max-width: 520px)");

  // View Mode: 'prototype' | 'hindi-comparison' | 'components' (design tools, wide screens only)
  const [viewMode, setViewMode] = useState<"prototype" | "hindi-comparison" | "components">("prototype");
  const [showHelpModal, setShowHelpModal] = useState(false);

  // /done is the final screen after the 8 steps
  const rawIndex = PATHS.indexOf(pathname as (typeof PATHS)[number]);
  const currentIndex = rawIndex === -1 ? (pathname === "/done" ? PATHS.length - 1 : 0) : rawIndex;
  const goTo = (i: number) => navigate(PATHS[Math.max(0, Math.min(PATHS.length - 1, i))]);
  const goToNext = () => goTo(currentIndex + 1);
  const goToBack = () => goTo(currentIndex - 1);

  const handleRestart = () => {
    session.reset();
    navigate("/");
    speakText("Welcome back to Saathi.", "en-IN");
  };

  const handleOpenHelp = () => {
    setShowHelpModal(true);
    speakText(t("helpLine"), LANG_CODE[lang]);
  };

  const common = { onNext: goToNext, onBack: goToBack, onOpenHelp: handleOpenHelp };

  const routes = (
    <Routes>
      <Route path="/" element={<Screen1Language onNext={goToNext} onOpenHelp={handleOpenHelp} />} />
      <Route path="/consent" element={<Screen2Consent {...common} />} />
      <Route path="/interview" element={<Screen3Voice {...common} />} />
      <Route path="/camera" element={<Screen4Camera {...common} />} />
      <Route path="/problems" element={<Screen5Problems {...common} />} />
      <Route path="/readiness" element={<Screen6Score {...common} />} />
      <Route path="/status" element={<Screen7Status {...common} />} />
      <Route path="/qr" element={<Screen8QR onRestart={handleRestart} onBack={goToBack} onOpenHelp={handleOpenHelp} />} />
      <Route path="/done" element={<Screen9Done onRestart={handleRestart} onOpenHelp={handleOpenHelp} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );

  const helpModal = showHelpModal && (
    <div className="app-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="help-modal-heading">
      <div className="app-modal-card senior-help-card">
        <div className="modal-header">
          <div className="modal-icon-badge help-badge">
            <Icon name="headset" size={28} />
          </div>
          <h3 id="help-modal-heading" className="modal-title">
            {t("helpTitle")}
          </h3>
        </div>

        <div className="modal-body-content">
          <p className="help-friendly-line">{t("helpLine")}</p>

          <div className="help-options-stack">
            <a href="tel:18004252841" className="help-call-direct-btn">
              <Icon name="phone" size={24} />
              <div className="call-info">
                <strong>{t("callToll")}</strong>
                <span>{t("callAvail")}</span>
              </div>
            </a>

            <button
              type="button"
              onClick={() => {
                setShowHelpModal(false);
                speakText(t("callbackSpeech"), LANG_CODE[lang]);
              }}
              className="help-callback-btn"
            >
              <Icon name="whatsapp" size={24} />
              <div className="call-info">
                <strong>{t("callback")}</strong>
                <span>{t("callbackSub")}</span>
              </div>
            </button>
          </div>
        </div>

        <button type="button" onClick={() => setShowHelpModal(false)} className="modal-close-primary-btn">
          {t("backToForm")}
        </button>
      </div>
    </div>
  );

  // The language switcher only makes sense before the interview language is fixed.
  const switcher = (pathname === "/" || pathname === "/consent") && <LanguageSwitcher />;

  if (isPhone) {
    return (
      <div className="phone-app">
        {switcher && <div className="phone-app-switcher">{switcher}</div>}
        <div className="phone-app-screen">{routes}</div>
        {helpModal}
      </div>
    );
  }

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
            <span className="header-tagline">Senior-First Voice Banking Assistant</span>
          </div>
        </div>

        <nav className="header-view-tabs" aria-label="View Switcher">
          <Tab active={viewMode === "prototype"} onClick={() => setViewMode("prototype")} icon="phone">8 Connected Screens</Tab>
          <Tab active={viewMode === "hindi-comparison"} onClick={() => setViewMode("hindi-comparison")} icon="check">Hindi Dual Frame (Screens 3 &amp; 7)</Tab>
          <Tab active={viewMode === "components"} onClick={() => setViewMode("components")} icon="document">Component Set</Tab>
        </nav>
        <LanguageSwitcher />
      </header>

      <main className="main-content-layout">
        {viewMode === "prototype" && (
          <div className="prototype-interactive-stage">
            <div className="screen-selector-toolbar" aria-label="Screen Quick Jump">
              <span className="toolbar-label">Screen {currentIndex + 1} of 8:</span>
              <div className="screen-pill-buttons">
                {screenNames.map((name, idx) => (
                  <button key={idx} type="button" onClick={() => goTo(idx)} className={`screen-pill-btn ${currentIndex === idx ? "active" : ""}`}>
                    {name}
                  </button>
                ))}
              </div>
            </div>

            {/* iPhone 14 Device Canvas (390 x 844) */}
            <div className="iphone-canvas-container">
              <div className="iphone-14-mockup-frame" id="iphone-14-viewport" tabIndex={0} aria-label="iPhone 14 Canvas: 390 by 844">
                <div className="iphone-dynamic-island" />
                <div className="iphone-status-bar">
                  <span className="status-clock">10:30</span>
                  <div className="status-system-indicators">
                    <span className="signal-bars">●●●●</span>
                    <span className="wifi-icon">5G</span>
                    <span className="battery-badge">100%</span>
                  </div>
                </div>

                <div className="screen-display-viewport">{routes}</div>

                <div className="iphone-home-indicator" />
              </div>

              <div className="prototype-quick-stepper" aria-label="Screen flow links">
                <button type="button" onClick={goToBack} disabled={currentIndex === 0} className="step-nav-btn prev-btn">
                  <Icon name="chevron" size={20} className="rotate-180" />
                  <span>Previous</span>
                </button>

                <div className="stepper-dots-indicator">
                  {PATHS.map((_, i) => (
                    <button key={i} type="button" onClick={() => goTo(i)} className={`stepper-dot ${currentIndex === i ? "active" : ""}`} aria-label={`Jump to Screen ${i + 1}`} />
                  ))}
                </div>

                <button type="button" onClick={currentIndex === 7 ? handleRestart : goToNext} className="step-nav-btn next-btn">
                  <span>{currentIndex === 7 ? "Restart" : "Next Screen"}</span>
                  <Icon name="chevron" size={20} />
                </button>
              </div>
            </div>
          </div>
        )}

        {viewMode === "hindi-comparison" && <HindiFrames onOpenHelp={handleOpenHelp} />}
        {viewMode === "components" && <ComponentShowcase onOpenHelp={handleOpenHelp} />}
      </main>

      {helpModal}
    </div>
  );
}

function Tab({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: "phone" | "check" | "document"; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`tab-switch-btn ${active ? "active" : ""}`}>
      <Icon name={icon} size={18} />
      <span>{children}</span>
    </button>
  );
}

export default App;
