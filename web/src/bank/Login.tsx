import { useState, type FormEvent } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { loginBanker, useBankAuth, type LoginError } from "./firebase";

const MESSAGE: Record<LoginError, string> = {
  bad_credentials: "Wrong email or password.",
  too_many: "Too many attempts. Please wait a few minutes and try again.",
  network: "Cannot reach Firebase. Check your internet connection.",
  disabled: "This account has been disabled.",
  not_enabled: "Email/Password sign-in is not enabled in Firebase Authentication (Console > Authentication > Sign-in method).",
  not_banker: "This account does not have banker access (the role=banker claim is missing). Ask an administrator to run set-banker-claim.",
  other: "Could not sign in. Please try again.",
};

export function BankLogin() {
  const auth = useBankAuth();
  const from = (useLocation().state as { from?: string } | null)?.from;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (auth.status === "banker") return <Navigate to={from && from.startsWith("/bank") ? from : "/bank"} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const err = await loginBanker(email, password);
    setBusy(false);
    if (err) setError(MESSAGE[err]);
  };

  return (
    <div className="bank-login-page">
      <form className="bank-login-card" onSubmit={submit}>
        <img src="/saathi-logo.png" alt="" className="bank-login-logo" />
        <h1>Saathi · Bank sign in</h1>
        <p className="bank-muted">For bank officers. Customers use the main app.</p>

        {auth.status === "notConfigured" && (
          <p className="bank-notice bank-notice--warn">The app is not set up yet: Firebase keys (VITE_FIREBASE_*) are missing in web/.env.</p>
        )}
        {from && auth.status === "signedOut" && (
          <p className="bank-notice bank-notice--warn">Your session ended. Please sign in again to continue.</p>
        )}
        {auth.status === "notBanker" && (
          <p className="bank-notice bank-notice--warn">{auth.email} is signed in without banker access. Sign in with a banker account.</p>
        )}

        <label>
          Email
          <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </label>
        <label>
          Password
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>

        {error && <p className="bank-notice bank-notice--warn" role="alert">{error}</p>}

        <button type="submit" className="bank-btn bank-btn--primary bank-btn--wide" disabled={busy || auth.status === "notConfigured"}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}

export default BankLogin;
