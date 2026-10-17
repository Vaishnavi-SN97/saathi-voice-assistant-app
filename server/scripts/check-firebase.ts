// Verifies FIREBASE_* credentials parse and can reach Firestore (read-only). Prints no secrets.
import { loadEnv } from "../src/env.js";
import { firebaseDeps } from "../src/firebase.js";
const env = loadEnv();
try {
  await firebaseDeps(env).store.get("applications/probe");
  console.log("firebase ok");
} catch (e) { console.log("firebase FAIL:", (e as Error).message.slice(0, 200)); }
