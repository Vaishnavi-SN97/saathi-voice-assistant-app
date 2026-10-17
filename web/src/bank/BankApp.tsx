import type { ReactNode } from "react";
import { Link, Navigate, NavLink, Route, Routes } from "react-router-dom";
import { BankCheckin } from "./Checkin";
import { BankDetail } from "./Detail";
import { BankLogin } from "./Login";
import { BankMetrics } from "./Metrics";
import { BankQueue } from "./Queue";
import { logoutBanker, useBankAuth } from "./firebase";
import "./bank.css";

function Shell({ email, children }: { email?: string; children: ReactNode }) {
  return (
    <div className="bank-shell">
      <header className="bank-header">
        <Link to="/bank" className="bank-brand">
          <img src="/saathi-logo.png" alt="" />
          <span>
            साथी <small>Saathi · Bank</small>
          </span>
        </Link>
        {email && (
          <nav className="bank-nav" aria-label="Bank sections">
            <NavLink to="/bank" end>Queue</NavLink>
            <NavLink to="/bank/checkin">Check-in</NavLink>
            <NavLink to="/bank/metrics">Numbers</NavLink>
          </nav>
        )}
        {email && (
          <div className="bank-user">
            <span>{email}</span>
            <button type="button" className="bank-btn bank-btn--ghost" onClick={() => void logoutBanker()}>
              Sign out
            </button>
          </div>
        )}
      </header>
      <main className="bank-main">{children}</main>
    </div>
  );
}

/** Only signed-in users with the role=banker claim get through. */
function Guard({ children }: { children: (email: string) => ReactNode }) {
  const auth = useBankAuth();
  if (auth.status === "notConfigured")
    return <Shell><p className="bank-notice bank-notice--warn">The app is not set up yet: Firebase keys (VITE_FIREBASE_*) are missing in web/.env.</p></Shell>;
  if (auth.status === "loading") return <Shell><div className="bank-spinner" role="status" aria-label="Loading" /></Shell>;
  if (auth.status === "signedOut") return <Navigate to="/bank/login" replace />;
  if (auth.status === "notBanker")
    return (
      <Shell email={auth.email}>
        <p className="bank-notice bank-notice--warn">
          {auth.email} is signed in but does not have banker access. Ask an administrator to run <code>npm run set-banker -- {auth.email}</code> in <code>server/</code>, then sign out and in again.
        </p>
      </Shell>
    );
  return <Shell email={auth.email}>{children(auth.email)}</Shell>;
}

export function BankApp() {
  return (
    <Routes>
      <Route path="/bank/login" element={<BankLogin />} />
      <Route path="/bank" element={<Guard>{() => <BankQueue />}</Guard>} />
      <Route path="/bank/app/:id" element={<Guard>{() => <BankDetail />}</Guard>} />
      <Route path="/bank/checkin" element={<Guard>{() => <BankCheckin />}</Guard>} />
      <Route path="/bank/metrics" element={<Guard>{() => <BankMetrics />}</Guard>} />
      <Route path="*" element={<Navigate to="/bank" replace />} />
    </Routes>
  );
}

export default BankApp;
