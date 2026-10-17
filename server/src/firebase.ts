import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import type { Env } from "./env.js";
import { FirestoreStore } from "./store.js";
import type { TokenVerifier } from "./auth.js";

function init(env: Env) {
  if (getApps().length) return getApps()[0];
  const credential =
    env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY
      ? cert({ projectId: env.FIREBASE_PROJECT_ID, clientEmail: env.FIREBASE_CLIENT_EMAIL, privateKey: env.FIREBASE_PRIVATE_KEY })
      : applicationDefault();
  return initializeApp({ credential, projectId: env.FIREBASE_PROJECT_ID });
}

export function firebaseDeps(env: Env): { store: FirestoreStore; verifier: TokenVerifier } {
  const app = init(env);
  const db = getFirestore(app);
  db.settings({ ignoreUndefinedProperties: true });
  const auth = getAuth(app);
  return {
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
