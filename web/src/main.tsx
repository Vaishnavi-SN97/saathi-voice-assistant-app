import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, useLocation } from "react-router-dom";
// Self-hosted fonts (no Google Fonts requests)
import "@fontsource/plus-jakarta-sans/500.css";
import "@fontsource/plus-jakarta-sans/600.css";
import "@fontsource/plus-jakarta-sans/700.css";
import "@fontsource/plus-jakarta-sans/800.css";
import "@fontsource/noto-sans/400.css";
import "@fontsource/noto-sans/500.css";
import "@fontsource/noto-sans/600.css";
import "@fontsource/noto-sans/700.css";
import "@fontsource/noto-sans/800.css";
import "@fontsource/noto-sans-devanagari/400.css";
import "@fontsource/noto-sans-devanagari/500.css";
import "@fontsource/noto-sans-devanagari/600.css";
import "@fontsource/noto-sans-devanagari/700.css";
import "@fontsource/noto-sans-devanagari/800.css";
import "@fontsource/noto-sans-kannada/400.css";
import "@fontsource/noto-sans-kannada/500.css";
import "@fontsource/noto-sans-kannada/600.css";
import "@fontsource/noto-sans-kannada/700.css";
import "@fontsource/noto-sans-kannada/800.css";
import App from "./App";
import BankApp from "./bank/BankApp";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { I18nProvider, useI18n } from "./lib/i18n";
import { SessionProvider } from "./lib/session";
import "./index.css";

/** /bank is the banker app (its own sign-in and layout); everything else is the customer app. */
/** Customer screens: the crash screen speaks in the language the person chose. */
function CustomerApp() {
  const { lang } = useI18n();
  return (
    <ErrorBoundary lang={lang}>
      <SessionProvider>
        <App />
      </SessionProvider>
    </ErrorBoundary>
  );
}

function Root() {
  const { pathname } = useLocation();
  return pathname === "/bank" || pathname.startsWith("/bank/") ? (
    <ErrorBoundary>
      <BankApp />
    </ErrorBoundary>
  ) : (
    <I18nProvider>
      <CustomerApp />
    </I18nProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Root />
    </BrowserRouter>
  </React.StrictMode>,
);
