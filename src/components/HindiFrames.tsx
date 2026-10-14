import { useState } from "react";
import { Screen3Voice } from "./Screens/Screen3Voice";
import { Screen7Status } from "./Screens/Screen7Status";
import { Icon } from "./Icons";

export function HindiFrames({
  onOpenHelp,
}: {
  onOpenHelp: () => void;
}) {
  const [activeScreen, setActiveScreen] = useState<3 | 7>(3);

  return (
    <div className="hindi-frames-view">
      <div className="multilingual-header-bar">
        <div className="badge-and-title">
          <span className="multilingual-badge">
            <Icon name="check" size={16} /> Multilingual Layout Proof
          </span>
          <h2 className="multilingual-title">
            Hindi & English Side-by-Side Comparison (Screens 3 & 7)
          </h2>
          <p className="multilingual-desc">
            Demonstrating that generous spacing (24px page padding, 16px gaps),
            large typography (min 18px body, 28px headings, 30px questions),
            and Devanagari script render cleanly without text truncation or awkward wraps.
          </p>
        </div>

        {/* Switcher between Screen 3 and Screen 7 */}
        <div className="dual-screen-switcher">
          <button
            type="button"
            onClick={() => setActiveScreen(3)}
            className={`dual-screen-tab ${activeScreen === 3 ? "active" : ""}`}
          >
            <Icon name="mic" size={18} />
            <span>Screen 3: Voice Interview</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveScreen(7)}
            className={`dual-screen-tab ${activeScreen === 7 ? "active" : ""}`}
          >
            <Icon name="document" size={18} />
            <span>Screen 7: Application Status</span>
          </button>
        </div>
      </div>

      {/* Dual Frames Container */}
      <div className="dual-phones-row">
        {/* Frame 1: English Version */}
        <div className="phone-wrapper-column">
          <div className="phone-lang-tag">
            <span className="lang-pill en">English Version</span>
            <span className="spec-tag">iPhone 14 · 390 × 844</span>
          </div>
          <div className="iphone-frame-shell">
            {/* iOS Status Bar */}
            <div className="iphone-status-bar">
              <span className="status-time">10:30</span>
              <div className="status-notch" />
              <div className="status-icons">
                <span className="bar-signal">●●●●</span>
                <span className="bar-wifi">WiFi</span>
                <span className="bar-battery">98%</span>
              </div>
            </div>

            <div className="screen-content-scroll">
              {activeScreen === 3 ? (
                <Screen3Voice
                  isHindi={false}
                  onNext={() => {}}
                  onBack={() => {}}
                  onOpenHelp={onOpenHelp}
                />
              ) : (
                <Screen7Status
                  isHindi={false}
                  onNext={() => {}}
                  onBack={() => {}}
                  onOpenHelp={onOpenHelp}
                />
              )}
            </div>
          </div>
        </div>

        {/* Frame 2: Pure Hindi Version */}
        <div className="phone-wrapper-column">
          <div className="phone-lang-tag">
            <span className="lang-pill hi">हिन्दी संस्करण (Hindi)</span>
            <span className="spec-tag">Devanagari Noto Sans · 390 × 844</span>
          </div>
          <div className="iphone-frame-shell hi-border">
            {/* iOS Status Bar */}
            <div className="iphone-status-bar">
              <span className="status-time">10:30</span>
              <div className="status-notch" />
              <div className="status-icons">
                <span className="bar-signal">●●●●</span>
                <span className="bar-wifi">WiFi</span>
                <span className="bar-battery">98%</span>
              </div>
            </div>

            <div className="screen-content-scroll hindi-screen-typography">
              {activeScreen === 3 ? (
                <Screen3Voice
                  isHindi={true}
                  onNext={() => {}}
                  onBack={() => {}}
                  onOpenHelp={onOpenHelp}
                />
              ) : (
                <Screen7Status
                  isHindi={true}
                  onNext={() => {}}
                  onBack={() => {}}
                  onOpenHelp={onOpenHelp}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HindiFrames;
