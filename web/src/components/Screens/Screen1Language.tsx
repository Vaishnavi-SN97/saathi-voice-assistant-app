import { Icon } from "../Icons";
import {
  PrimaryButton,
  ProgressDots,
  LanguageCard,
  BottomHelpBar,
} from "../UIComponents";
import { LANG_NAME, useI18n } from "../../lib/i18n";
import { speakServer } from "../../lib/speak";
import type { Language } from "../../types";

const languages: {
  lang: Language | null;
  script: string;
  name: string;
  speechText: string;
  code: "hi-IN" | "kn-IN" | "en-IN";
}[] = [
  { lang: "hi", script: "हिन्दी", name: "Hindi", speechText: "नमस्ते! साथी में आपका स्वागत है।", code: "hi-IN" },
  { lang: "kn", script: "ಕನ್ನಡ", name: "Kannada", speechText: "ನಮಸ್ಕಾರ! ಸಾಥಿಗೆ ಸುಸ್ವಾಗತ.", code: "kn-IN" },
  { lang: "en", script: "English", name: "English", speechText: "Hello! Welcome to Saathi, your voice banking companion.", code: "en-IN" },
  { lang: null, script: "More languages", name: "अन्य भाषाएँ", speechText: "More languages coming soon.", code: "en-IN" },
];

export function Screen1Language({
  onNext,
  onOpenHelp,
}: {
  onNext: () => void;
  onOpenHelp: () => void;
}) {
  const { lang, setLang, t } = useI18n();

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
            <p className="brand-tagline">{t("appTag")}</p>
          </div>
        </div>

        <div className="welcome-heading-box">
          <h2 className="screen-main-heading">{t("chooseLang")}</h2>
          <p className="screen-sub-trans">{t("chooseLangSub")}</p>
        </div>
      </div>

      {/* Language Cards: choosing one switches the whole app to that language */}
      <div className="language-cards-grid">
        {languages.map((l) => (
          <LanguageCard
            key={l.script}
            scriptName={l.script}
            englishName={l.name}
            isSelected={l.lang !== null && lang === l.lang}
            onSelect={() => {
              if (l.lang) setLang(l.lang);
              void speakServer(l.speechText, l.lang ?? "en");
            }}
            onSpeak={() => void speakServer(l.speechText, l.lang ?? "en")}
          />
        ))}
      </div>

      {/* Reassurance note */}
      <div className="reassurance-pill-box">
        <Icon name="mic" size={20} />
        <span>{t("speakOwnWords")}</span>
      </div>

      {/* Primary Action Button */}
      <div className="screen-bottom-action">
        <PrimaryButton onClick={onNext}>
          {t("continueIn", { lang: LANG_NAME[lang] })}
        </PrimaryButton>
      </div>

      {/* Bottom Help Link */}
      <BottomHelpBar onHelpClick={onOpenHelp} label={t("help")} />
    </div>
  );
}

export default Screen1Language;
