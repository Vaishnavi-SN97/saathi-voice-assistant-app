import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { Language } from "../types";

// All hi / kn text is machine-written and needs a native-speaker check (see PROGRESS.md).
const en = {
  appTag: "Your trusted voice banking assistant",
  chooseLang: "Choose your language",
  chooseLangSub: "अपनी भाषा चुनें · ನಿಮ್ಮ ಭಾಷೆಯನ್ನು ಆರಿಸಿ",
  speakOwnWords: "You can speak comfortably in your own words.",
  continueIn: "Continue in {lang}",
  moreLangs: "More languages coming soon.",
  back: "Back",
  listenThis: "Listen to this",
  help: "Help / talk to a person",
  yourSafety: "Your Safety First",
  beforeStart: "Before we start",
  c1: "We will listen to you and read your documents to fill your bank form.",
  c2: "We will never ask for your OTP or PIN.",
  c3: "A bank officer checks everything before it is final.",
  privTitle: "Your data stays private.",
  privSub: "Protected and only shared with your bank.",
  agree: "I agree, let’s begin",
  starting: "Starting…",
  readMore: "Read more about privacy & safety",
  mTitle: "Our Senior Safety Promise",
  m1: "Zero fraud risk: Saathi will never ask for your card CVV, ATM PIN, internet banking password, or phone SMS OTP.",
  m2: "Human verification: your application is not completed automatically. A bank officer reviews it in person.",
  m3: "Voice consent: you are in control at all times. You can stop or pause whenever you wish.",
  understand: "I Understand",
  consentSpeech:
    "Before we start. We will listen to you and read your documents to fill your bank form. We will never ask for your OTP or PIN. A bank officer checks everything before it is final. Your data stays private.",
  qChip: "Question {n} of {total}",
  pleaseTell: "Please tell me",
  tapSpeak: "Tap and speak",
  listening: "Listening… tap to stop",
  thinking: "Thinking…",
  timeLimit: "{s} s of 12 s",
  listenAgain: "Listen again",
  speakSlower: "Speak slower",
  didIHear: "Did I hear this right?",
  yesCorrect: "Yes, correct",
  noSayAgain: "No, say again",
  typeInstead: "Type instead",
  typeTitle: "Type your answer",
  typeHint: "Type your answer below:",
  send: "Send",
  cancel: "Cancel",
  pickOne: "Or tap one:",
  micDenied: "The microphone is blocked. Please allow it in your browser, or type your answer instead.",
  micUnsupported: "This browser cannot record audio. Please type your answer instead.",
  noSpeech: "I did not hear anything. Please try again, or type instead.",
  netError: "Cannot reach Saathi. Please check your internet and try again.",
  genericError: "Something went wrong. Please try again.",
  notConfigured: "The app is not set up yet (Firebase keys are missing in web/.env).",
  tryAgain: "Try again",
  helpTitle: "Talk to a Bank Officer",
  helpLine: "Do not worry. You do not need to do this alone. Our friendly branch assistant is here to guide you.",
  callToll: "Call Toll-Free: 1800-425-2841",
  callAvail: "Available in Kannada, Hindi, English",
  callback: "Request a Call Back",
  callbackSub: "An officer will call you in 5 minutes",
  callbackSpeech: "Request received. An officer from the branch will call your phone in 5 minutes.",
  backToForm: "Back to form",
};

const hi: typeof en = {
  appTag: "आपका भरोसेमंद वॉइस बैंकिंग साथी",
  chooseLang: "अपनी भाषा चुनें",
  chooseLangSub: "Choose your language · ನಿಮ್ಮ ಭಾಷೆಯನ್ನು ಆರಿಸಿ",
  speakOwnWords: "आप अपने शब्दों में आराम से बोल सकते हैं।",
  continueIn: "{lang} में आगे बढ़ें",
  moreLangs: "और भाषाएँ जल्द आ रही हैं।",
  back: "वापस",
  listenThis: "सुनें",
  help: "मदद / किसी व्यक्ति से बात करें",
  yourSafety: "आपकी सुरक्षा सबसे पहले",
  beforeStart: "शुरू करने से पहले",
  c1: "हम आपकी बात सुनेंगे और आपके दस्तावेज़ पढ़कर आपका बैंक फ़ॉर्म भरेंगे।",
  c2: "हम आपसे कभी ओटीपी या पिन नहीं मांगेंगे।",
  c3: "अंतिम होने से पहले बैंक अधिकारी सब कुछ जाँचते हैं।",
  privTitle: "आपका डेटा निजी रहता है।",
  privSub: "सुरक्षित, और केवल आपके बैंक के साथ साझा किया जाता है।",
  agree: "मैं सहमत हूँ, शुरू करें",
  starting: "शुरू हो रहा है…",
  readMore: "निजता और सुरक्षा के बारे में और पढ़ें",
  mTitle: "हमारा सुरक्षा वादा",
  m1: "धोखाधड़ी का कोई खतरा नहीं: साथी कभी आपका कार्ड सीवीवी, एटीएम पिन, इंटरनेट बैंकिंग पासवर्ड या एसएमएस ओटीपी नहीं मांगेगा।",
  m2: "इंसानी जाँच: आपका आवेदन अपने-आप पूरा नहीं होता। बैंक अधिकारी उसे खुद देखते हैं।",
  m3: "आवाज़ की सहमति: नियंत्रण हमेशा आपके हाथ में है। आप जब चाहें रुक सकते हैं।",
  understand: "मैं समझ गया",
  consentSpeech:
    "शुरू करने से पहले। हम आपकी बात सुनेंगे और आपके दस्तावेज़ पढ़कर आपका बैंक फ़ॉर्म भरेंगे। हम आपसे कभी ओटीपी या पिन नहीं मांगेंगे। अंतिम होने से पहले बैंक अधिकारी सब कुछ जाँचते हैं। आपका डेटा निजी रहता है।",
  qChip: "प्रश्न {n} / {total}",
  pleaseTell: "कृपया बताइए",
  tapSpeak: "बोलने के लिए दबाएं",
  listening: "सुन रहे हैं… रोकने के लिए दबाएं",
  thinking: "समझ रहे हैं…",
  timeLimit: "{s} / 12 सेकंड",
  listenAgain: "फिर से सुनें",
  speakSlower: "धीरे बोलें",
  didIHear: "क्या मैंने सही सुना?",
  yesCorrect: "हाँ, सही है",
  noSayAgain: "नहीं, फिर से बोलें",
  typeInstead: "लिखकर दर्ज करें",
  typeTitle: "अपना जवाब लिखें",
  typeHint: "अपना जवाब नीचे लिखें:",
  send: "भेजें",
  cancel: "रद्द करें",
  pickOne: "या एक चुनें:",
  micDenied: "माइक्रोफ़ोन बंद है। कृपया ब्राउज़र में अनुमति दें, या जवाब लिखकर दें।",
  micUnsupported: "यह ब्राउज़र आवाज़ रिकॉर्ड नहीं कर सकता। कृपया जवाब लिखकर दें।",
  noSpeech: "मुझे कुछ सुनाई नहीं दिया। कृपया फिर कोशिश करें, या लिखकर दें।",
  netError: "साथी से जुड़ नहीं पा रहे। कृपया इंटरनेट जाँचें और फिर कोशिश करें।",
  genericError: "कुछ गड़बड़ हो गई। कृपया फिर कोशिश करें।",
  notConfigured: "ऐप अभी तैयार नहीं है (web/.env में Firebase कुंजियाँ नहीं हैं)।",
  tryAgain: "फिर कोशिश करें",
  helpTitle: "बैंक अधिकारी से बात करें",
  helpLine: "चिंता न करें। आपको यह अकेले नहीं करना है। हमारे शाखा सहायक आपकी मदद के लिए हैं।",
  callToll: "टोल-फ़्री कॉल करें: 1800-425-2841",
  callAvail: "कन्नड़, हिन्दी, अंग्रेज़ी में उपलब्ध",
  callback: "वापस कॉल का अनुरोध करें",
  callbackSub: "एक अधिकारी 5 मिनट में आपको कॉल करेंगे",
  callbackSpeech: "अनुरोध मिल गया। शाखा के एक अधिकारी 5 मिनट में आपके फ़ोन पर कॉल करेंगे।",
  backToForm: "फ़ॉर्म पर वापस",
};

const kn: typeof en = {
  appTag: "ನಿಮ್ಮ ನಂಬಿಕೆಯ ಧ್ವನಿ ಬ್ಯಾಂಕಿಂಗ್ ಸಹಾಯಕ",
  chooseLang: "ನಿಮ್ಮ ಭಾಷೆಯನ್ನು ಆರಿಸಿ",
  chooseLangSub: "Choose your language · अपनी भाषा चुनें",
  speakOwnWords: "ನೀವು ನಿಮ್ಮ ಸ್ವಂತ ಮಾತುಗಳಲ್ಲಿ ಆರಾಮವಾಗಿ ಮಾತನಾಡಬಹುದು.",
  continueIn: "{lang} ನಲ್ಲಿ ಮುಂದುವರಿಸಿ",
  moreLangs: "ಇನ್ನಷ್ಟು ಭಾಷೆಗಳು ಶೀಘ್ರದಲ್ಲಿ ಬರಲಿವೆ.",
  back: "ಹಿಂದೆ",
  listenThis: "ಕೇಳಿ",
  help: "ಸಹಾಯ / ಒಬ್ಬರೊಂದಿಗೆ ಮಾತನಾಡಿ",
  yourSafety: "ನಿಮ್ಮ ಸುರಕ್ಷತೆ ಮೊದಲು",
  beforeStart: "ಪ್ರಾರಂಭಿಸುವ ಮೊದಲು",
  c1: "ನಾವು ನಿಮ್ಮ ಮಾತು ಕೇಳುತ್ತೇವೆ ಮತ್ತು ನಿಮ್ಮ ದಾಖಲೆಗಳನ್ನು ಓದಿ ನಿಮ್ಮ ಬ್ಯಾಂಕ್ ಫಾರ್ಮ್ ತುಂಬುತ್ತೇವೆ.",
  c2: "ನಾವು ಎಂದಿಗೂ ನಿಮ್ಮ ಒಟಿಪಿ ಅಥವಾ ಪಿನ್ ಕೇಳುವುದಿಲ್ಲ.",
  c3: "ಅಂತಿಮವಾಗುವ ಮೊದಲು ಬ್ಯಾಂಕ್ ಅಧಿಕಾರಿ ಎಲ್ಲವನ್ನೂ ಪರಿಶೀಲಿಸುತ್ತಾರೆ.",
  privTitle: "ನಿಮ್ಮ ಮಾಹಿತಿ ಖಾಸಗಿಯಾಗಿರುತ್ತದೆ.",
  privSub: "ಸುರಕ್ಷಿತ, ಮತ್ತು ನಿಮ್ಮ ಬ್ಯಾಂಕ್‌ನೊಂದಿಗೆ ಮಾತ್ರ ಹಂಚಿಕೊಳ್ಳಲಾಗುತ್ತದೆ.",
  agree: "ನಾನು ಒಪ್ಪುತ್ತೇನೆ, ಪ್ರಾರಂಭಿಸೋಣ",
  starting: "ಪ್ರಾರಂಭವಾಗುತ್ತಿದೆ…",
  readMore: "ಗೌಪ್ಯತೆ ಮತ್ತು ಸುರಕ್ಷತೆ ಬಗ್ಗೆ ಇನ್ನಷ್ಟು ಓದಿ",
  mTitle: "ನಮ್ಮ ಸುರಕ್ಷತಾ ಭರವಸೆ",
  m1: "ವಂಚನೆಯ ಅಪಾಯವಿಲ್ಲ: ಸಾಥಿ ಎಂದಿಗೂ ನಿಮ್ಮ ಕಾರ್ಡ್ ಸಿವಿವಿ, ಎಟಿಎಂ ಪಿನ್, ಇಂಟರ್ನೆಟ್ ಬ್ಯಾಂಕಿಂಗ್ ಪಾಸ್‌ವರ್ಡ್ ಅಥವಾ ಎಸ್‌ಎಂಎಸ್ ಒಟಿಪಿ ಕೇಳುವುದಿಲ್ಲ.",
  m2: "ಮಾನವ ಪರಿಶೀಲನೆ: ನಿಮ್ಮ ಅರ್ಜಿ ತಾನಾಗಿ ಪೂರ್ಣಗೊಳ್ಳುವುದಿಲ್ಲ. ಬ್ಯಾಂಕ್ ಅಧಿಕಾರಿ ಅದನ್ನು ಖುದ್ದಾಗಿ ನೋಡುತ್ತಾರೆ.",
  m3: "ಧ್ವನಿ ಸಮ್ಮತಿ: ನಿಯಂತ್ರಣ ಯಾವಾಗಲೂ ನಿಮ್ಮ ಕೈಯಲ್ಲಿದೆ. ನೀವು ಬಯಸಿದಾಗ ನಿಲ್ಲಿಸಬಹುದು.",
  understand: "ನನಗೆ ಅರ್ಥವಾಯಿತು",
  consentSpeech:
    "ಪ್ರಾರಂಭಿಸುವ ಮೊದಲು. ನಾವು ನಿಮ್ಮ ಮಾತು ಕೇಳುತ್ತೇವೆ ಮತ್ತು ನಿಮ್ಮ ದಾಖಲೆಗಳನ್ನು ಓದಿ ನಿಮ್ಮ ಬ್ಯಾಂಕ್ ಫಾರ್ಮ್ ತುಂಬುತ್ತೇವೆ. ನಾವು ಎಂದಿಗೂ ನಿಮ್ಮ ಒಟಿಪಿ ಅಥವಾ ಪಿನ್ ಕೇಳುವುದಿಲ್ಲ. ಅಂತಿಮವಾಗುವ ಮೊದಲು ಬ್ಯಾಂಕ್ ಅಧಿಕಾರಿ ಎಲ್ಲವನ್ನೂ ಪರಿಶೀಲಿಸುತ್ತಾರೆ. ನಿಮ್ಮ ಮಾಹಿತಿ ಖಾಸಗಿಯಾಗಿರುತ್ತದೆ.",
  qChip: "ಪ್ರಶ್ನೆ {n} / {total}",
  pleaseTell: "ದಯವಿಟ್ಟು ಹೇಳಿ",
  tapSpeak: "ಮಾತನಾಡಲು ಒತ್ತಿ",
  listening: "ಕೇಳುತ್ತಿದ್ದೇವೆ… ನಿಲ್ಲಿಸಲು ಒತ್ತಿ",
  thinking: "ಅರ್ಥಮಾಡಿಕೊಳ್ಳುತ್ತಿದ್ದೇವೆ…",
  timeLimit: "{s} / 12 ಸೆಕೆಂಡ್",
  listenAgain: "ಮತ್ತೆ ಕೇಳಿ",
  speakSlower: "ನಿಧಾನವಾಗಿ ಮಾತನಾಡಿ",
  didIHear: "ನಾನು ಸರಿಯಾಗಿ ಕೇಳಿದೆನೇ?",
  yesCorrect: "ಹೌದು, ಸರಿ",
  noSayAgain: "ಇಲ್ಲ, ಮತ್ತೆ ಹೇಳುತ್ತೇನೆ",
  typeInstead: "ಬದಲಿಗೆ ಟೈಪ್ ಮಾಡಿ",
  typeTitle: "ನಿಮ್ಮ ಉತ್ತರವನ್ನು ಟೈಪ್ ಮಾಡಿ",
  typeHint: "ನಿಮ್ಮ ಉತ್ತರವನ್ನು ಕೆಳಗೆ ಟೈಪ್ ಮಾಡಿ:",
  send: "ಕಳುಹಿಸಿ",
  cancel: "ರದ್ದುಮಾಡಿ",
  pickOne: "ಅಥವಾ ಒಂದನ್ನು ಆರಿಸಿ:",
  micDenied: "ಮೈಕ್ರೊಫೋನ್ ನಿರ್ಬಂಧಿಸಲಾಗಿದೆ. ದಯವಿಟ್ಟು ಬ್ರೌಸರ್‌ನಲ್ಲಿ ಅನುಮತಿಸಿ, ಅಥವಾ ಉತ್ತರವನ್ನು ಟೈಪ್ ಮಾಡಿ.",
  micUnsupported: "ಈ ಬ್ರೌಸರ್ ಧ್ವನಿ ರೆಕಾರ್ಡ್ ಮಾಡಲು ಸಾಧ್ಯವಿಲ್ಲ. ದಯವಿಟ್ಟು ಉತ್ತರವನ್ನು ಟೈಪ್ ಮಾಡಿ.",
  noSpeech: "ನನಗೆ ಏನೂ ಕೇಳಿಸಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ, ಅಥವಾ ಟೈಪ್ ಮಾಡಿ.",
  netError: "ಸಾಥಿಯನ್ನು ತಲುಪಲಾಗುತ್ತಿಲ್ಲ. ದಯವಿಟ್ಟು ಇಂಟರ್ನೆಟ್ ಪರಿಶೀಲಿಸಿ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
  genericError: "ಏನೋ ತಪ್ಪಾಗಿದೆ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
  notConfigured: "ಆಪ್ ಇನ್ನೂ ಸಿದ್ಧವಾಗಿಲ್ಲ (web/.env ನಲ್ಲಿ Firebase ಕೀಗಳು ಇಲ್ಲ).",
  tryAgain: "ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ",
  helpTitle: "ಬ್ಯಾಂಕ್ ಅಧಿಕಾರಿಯೊಂದಿಗೆ ಮಾತನಾಡಿ",
  helpLine: "ಚಿಂತಿಸಬೇಡಿ. ನೀವು ಇದನ್ನು ಒಬ್ಬರೇ ಮಾಡಬೇಕಿಲ್ಲ. ನಮ್ಮ ಶಾಖೆಯ ಸಹಾಯಕರು ನಿಮಗೆ ಸಹಾಯ ಮಾಡಲು ಇದ್ದಾರೆ.",
  callToll: "ಟೋಲ್-ಫ್ರೀ ಕರೆ ಮಾಡಿ: 1800-425-2841",
  callAvail: "ಕನ್ನಡ, ಹಿಂದಿ, ಇಂಗ್ಲಿಷ್‌ನಲ್ಲಿ ಲಭ್ಯ",
  callback: "ಮರುಕರೆಗೆ ವಿನಂತಿಸಿ",
  callbackSub: "ಒಬ್ಬ ಅಧಿಕಾರಿ 5 ನಿಮಿಷಗಳಲ್ಲಿ ನಿಮಗೆ ಕರೆ ಮಾಡುತ್ತಾರೆ",
  callbackSpeech: "ವಿನಂತಿ ಸಿಕ್ಕಿದೆ. ಶಾಖೆಯ ಒಬ್ಬ ಅಧಿಕಾರಿ 5 ನಿಮಿಷಗಳಲ್ಲಿ ನಿಮ್ಮ ಫೋನ್‌ಗೆ ಕರೆ ಮಾಡುತ್ತಾರೆ.",
  backToForm: "ಫಾರ್ಮ್‌ಗೆ ಹಿಂತಿರುಗಿ",
};

export type Key = keyof typeof en;
const DICT: Record<Language, typeof en> = { en, hi, kn };

export const LANG_CODE = { en: "en-IN", hi: "hi-IN", kn: "kn-IN" } as const;
export const LANG_NAME: Record<Language, string> = { en: "English", hi: "हिन्दी", kn: "ಕನ್ನಡ" };
const STORAGE_KEY = "saathi.lang";

function initialLang(): Language {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s === "en" || s === "hi" || s === "kn") return s;
  } catch { /* storage blocked: fall through */ }
  return "hi";
}

interface I18n {
  lang: Language;
  setLang: (l: Language) => void;
  t: (key: Key, vars?: Record<string, string | number>) => string;
}
const Ctx = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(initialLang);
  const setLang = useCallback((l: Language) => {
    setLangState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch { /* ignore */ }
    document.documentElement.lang = l;
  }, []);
  const t = useCallback<I18n["t"]>(
    (key, vars) => DICT[lang][key].replace(/\{(\w+)\}/g, (_, k) => String(vars?.[k] ?? `{${k}}`)),
    [lang],
  );
  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const v = useContext(Ctx);
  if (!v) throw new Error("useI18n outside I18nProvider");
  return v;
}

/** Compact switcher: EN | हिन्दी | ಕನ್ನಡ */
export function LanguageSwitcher() {
  const { lang, setLang } = useI18n();
  return (
    <div className="lang-switcher" role="group" aria-label="Language">
      {(["en", "hi", "kn"] as const).map((l) => (
        <button key={l} type="button" className={lang === l ? "active" : ""} aria-pressed={lang === l} onClick={() => setLang(l)}>
          {LANG_NAME[l]}
        </button>
      ))}
    </div>
  );
}
