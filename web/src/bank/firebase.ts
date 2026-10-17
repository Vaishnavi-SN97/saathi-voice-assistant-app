import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, getIdTokenResult, onAuthStateChanged, signInWithEmailAndPassword, signOut, type Auth, type User } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { firebaseConfigured, NotConfiguredError } from "../lib/firebase";
import { useEffect, useState } from "react";

// A SECOND Firebase app instance for bankers, so a banker session never mixes with the customers' anonymous session
// (each named app keeps its own sign-in state).
const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

const NAME = "saathi-bank";
export { firebaseConfigured };

function bankApp() {
  if (!firebaseConfigured) throw new NotConfiguredError();
  return getApps().some((a) => a.name === NAME) ? getApp(NAME) : initializeApp(cfg, NAME);
}
export const bankAuth = (): Auth => getAuth(bankApp());
export const bankDb = (): Firestore => getFirestore(bankApp());

/** ID token for the API (force=true refreshes custom claims right after a role change). */
export async function getBankToken(forceRefresh = false): Promise<string> {
  const user = bankAuth().currentUser;
  if (!user) throw new Error("not signed in");
  return user.getIdToken(forceRefresh);
}

export type BankAuthState =
  | { status: "loading" }
  | { status: "signedOut" }
  | { status: "notBanker"; email: string }
  | { status: "banker"; email: string; user: User }
  | { status: "notConfigured" };

const isBanker = async (user: User, force = false) => (await getIdTokenResult(user, force)).claims.role === "banker";

export function useBankAuth(): BankAuthState {
  const [state, setState] = useState<BankAuthState>(firebaseConfigured ? { status: "loading" } : { status: "notConfigured" });
  useEffect(() => {
    if (!firebaseConfigured) return;
    return onAuthStateChanged(bankAuth(), async (user) => {
      if (!user) return setState({ status: "signedOut" });
      try {
        setState((await isBanker(user)) ? { status: "banker", email: user.email ?? "", user } : { status: "notBanker", email: user.email ?? "" });
      } catch {
        setState({ status: "signedOut" });
      }
    });
  }, []);
  return state;
}

export type LoginError = "bad_credentials" | "too_many" | "network" | "disabled" | "not_enabled" | "not_banker" | "other";

/** Email + password sign-in. The role=banker custom claim is required; anything else is signed out again. */
export async function loginBanker(email: string, password: string): Promise<LoginError | null> {
  try {
    const cred = await signInWithEmailAndPassword(bankAuth(), email.trim(), password);
    if (!(await isBanker(cred.user, true))) {
      await signOut(bankAuth());
      return "not_banker";
    }
    return null;
  } catch (e) {
    const code = (e as { code?: string }).code ?? "";
    if (code === "auth/operation-not-allowed") return "not_enabled";
    if (code === "auth/too-many-requests") return "too_many";
    if (code === "auth/network-request-failed") return "network";
    if (code === "auth/user-disabled") return "disabled";
    if (/invalid-credential|wrong-password|user-not-found|invalid-email|missing-password/.test(code)) return "bad_credentials";
    return "other";
  }
}

export const logoutBanker = () => signOut(bankAuth());
