import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import type { Env } from "./env.js";
import { FirestoreStore } from "./store.js";
import type { TokenVerifier } from "./auth.js";

function init(env: Env) {
  if (getApps().length) {
    return getApps()[0];
  }

  // Firebase Admin credentials are required on Render.
  // Do NOT fall back to applicationDefault(), because Render
  // does not provide Google Application Default Credentials.
  if (!env.FIREBASE_CLIENT_EMAIL) {
    throw new Error(
      "FIREBASE_CLIENT_EMAIL is missing. Add it to the Render environment variables."
    );
  }

  if (!env.FIREBASE_PRIVATE_KEY) {
    throw new Error(
      "FIREBASE_PRIVATE_KEY is missing. Add it to the Render environment variables."
    );
  }

  const privateKey = env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n");

  return initializeApp({
    credential: cert({
      projectId: env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
    projectId: env.FIREBASE_PROJECT_ID,
  });
}

/** Firebase Admin dependencies used by the server. */
export function firebaseDeps(env: Env): {
  store: FirestoreStore;
  verifier: TokenVerifier;
  auth: ReturnType<typeof getAuth>;
} {
  const app = init(env);

  const db = getFirestore(app);

  db.settings({
    ignoreUndefinedProperties: true,
  });

  const auth = getAuth(app);

  return {
    auth,

    store: new FirestoreStore(db),

    verifier: async (token) => {
      const d = await auth.verifyIdToken(token);

      return {
        uid: d.uid,
        role: d.role === "banker" ? "banker" : "customer",
        anonymous: d.firebase?.sign_in_provider === "anonymous",
      };
    },
  };
}