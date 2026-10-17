import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, type User } from "firebase/auth";

// Public web config (safe in the browser). Secrets never live here: the browser only talks to our own API.
const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

export const firebaseConfigured = Boolean(cfg.apiKey && cfg.projectId && cfg.appId);

export class NotConfiguredError extends Error {
  constructor() {
    super("Firebase is not configured (set VITE_FIREBASE_* in web/.env)");
  }
}

let pending: Promise<User> | null = null;

/** Anonymous sign-in (no OTP). Resolves with the current user, signing in once if needed. */
export function ensureUser(): Promise<User> {
  if (!firebaseConfigured) return Promise.reject(new NotConfiguredError());
  pending ??= (async () => {
    const app = getApps().length ? getApp() : initializeApp(cfg);
    const auth = getAuth(app);
    await auth.authStateReady();
    if (!auth.currentUser) await signInAnonymously(auth);
    return auth.currentUser!;
  })().catch((e) => {
    pending = null; // allow a retry after a network failure
    throw e;
  });
  return pending;
}

/** Fresh-enough ID token for the API (the SDK refreshes it when it is close to expiry). */
export async function getIdToken(): Promise<string> {
  return (await ensureUser()).getIdToken();
}
