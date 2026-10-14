import { useState } from "react";
import { Icon } from "../Icons";
import {
  PrimaryButton,
  ProgressDots,
  LanguageCard,
  BottomHelpBar,
} from "../UIComponents";
import { speakText } from "../../utils/speech";

export function Screen1Language({
  onNext,
  onOpenHelp,
}: {
  onNext: (selectedLang: string) => void;
  onOpenHelp: () => void;
}) {
  const [selectedLang, setSelectedLang] = useState("हिन्दी");

  const languages = [
    {
      script: "हिन्दी",
      name: "Hindi",
      speechText: "नमस्ते! साथी में आपका स्वागत है।",
      code: "hi-IN" as const,
    },
    {
      script: "ಕನ್ನಡ",
      name: "Kannada",
      speechText: "ನಮಸ್ಕಾರ! ಸಾಥಿಗೆ ಸುಸ್ವಾಗತ.",
      code: "kn-IN" as const,
    },
    {
      script: "English",
      name: "English",
      speechText: "Hello! Welcome to Saathi, your voice banking companion.",
      code: "en-IN" as const,
    },
    {
      script: "More languages",
      name: "अन्य भाषाएँ",
      speechText: "More languages coming soon.",
      code: "en-IN" as const,
    },
  ];

  return (
    <div className="screen-container">
      {/* Top Progress indicator */}
      <ProgressDots activeStep={0} />

      {/* Header with Saathi Logo & Warm Welcome */}
      <div className="screen-header-center">
        <div className="brand-welcome-badge">
          <div className="brand-logo-icon">
            <img src="/saathi-logo.png" alt="Saathi Logo" />
          </div>
          <div className="brand-title-wrap">
            <h1 className="brand-app-name">
              साथी <span className="brand-sub">Saathi</span>
            </h1>
            <p className="brand-tagline">Your trusted voice banking assistant</p>
          </div>
        </div>

        <div className="welcome-heading-box">
          <h2 className="screen-main-heading">Choose your language</h2>
          <p className="screen-sub-trans">
            अपनी भाषा चुनें · ನಿಮ್ಮ ಭಾಷೆಯನ್ನು ಆರಿಸಿ
          </p>
        </div>
      </div>

      {/* Language Cards */}
      <div className="language-cards-grid">
        {languages.map((lang) => (
          <LanguageCard
            key={lang.script}
            scriptName={lang.script}
            englishName={lang.name}
            isSelected={selectedLang === lang.script}
            onSelect={() => {
              setSelectedLang(lang.script);
              speakText(lang.speechText, lang.code);
            }}
            onSpeak={() => speakText(lang.speechText, lang.code)}
          />
        ))}
      </div>

      {/* Reassurance note */}
      <div className="reassurance-pill-box">
        <Icon name="mic" size={20} />
        <span>You can speak comfortably in your own words.</span>
      </div>

      {/* Primary Action Button */}
      <div className="screen-bottom-action">
        <PrimaryButton onClick={() => onNext(selectedLang)}>
          Continue in {selectedLang}
        </PrimaryButton>
      </div>

      {/* Bottom Help Link */}
      <BottomHelpBar onHelpClick={onOpenHelp} />
    </div>
  );
}

export default Screen1Language;
