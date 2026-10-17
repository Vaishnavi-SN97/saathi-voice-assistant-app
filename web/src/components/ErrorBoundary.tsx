import { Component, type ErrorInfo, type ReactNode } from "react";
import { speakText } from "../utils/speech";

interface Props { children: ReactNode; lang?: "en" | "hi" | "kn" }
interface State { error: Error | null }

// Said aloud and shown when a screen crashes. Plain words, no technical detail; hi / kn need a native-speaker check.
const TEXT = {
  en: { title: "Something went wrong", body: "Sorry, this screen stopped working. Nothing you entered has been lost. Please try again.", retry: "Try again", home: "Start again" },
  hi: { title: "कुछ गड़बड़ हो गई", body: "माफ़ कीजिए, यह स्क्रीन रुक गई। आपकी भरी हुई जानकारी सुरक्षित है। कृपया फिर कोशिश करें।", retry: "फिर कोशिश करें", home: "शुरू से करें" },
  kn: { title: "ಏನೋ ತಪ್ಪಾಗಿದೆ", body: "ಕ್ಷಮಿಸಿ, ಈ ಪರದೆ ನಿಂತುಹೋಯಿತು. ನೀವು ಭರ್ತಿ ಮಾಡಿದ ಮಾಹಿತಿ ಸುರಕ್ಷಿತವಾಗಿದೆ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.", retry: "ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ", home: "ಮೊದಲಿನಿಂದ ಪ್ರಾರಂಭಿಸಿ" },
} as const;
const CODE = { en: "en-IN", hi: "hi-IN", kn: "kn-IN" } as const;

/**
 * Last line of defence: a render error anywhere shows a friendly screen (spoken too) instead of a blank page.
 * Failed API calls are handled by each screen; this catches the unexpected.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Screen crashed:", error, info.componentStack);
    const t = TEXT[this.props.lang ?? "en"];
    speakText(`${t.title}. ${t.body}`, CODE[this.props.lang ?? "en"]);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const t = TEXT[this.props.lang ?? "en"];
    return (
      <div className="crash-screen" role="alert">
        <div className="crash-card">
          <div className="crash-icon" aria-hidden="true">!</div>
          <h1>{t.title}</h1>
          <p>{t.body}</p>
          <div className="crash-actions">
            <button type="button" className="primary-btn" onClick={() => this.setState({ error: null })}>
              <span className="btn-label">{t.retry}</span>
            </button>
            <button type="button" className="crash-home-btn" onClick={() => { window.location.href = "/"; }}>
              {t.home}
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
