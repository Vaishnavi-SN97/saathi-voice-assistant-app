// Usage: npx tsx scripts/set-banker-claim.ts <email-or-uid> [--remove]
import { getAuth } from "firebase-admin/auth";
import { loadEnv } from "../src/env.js";
import { firebaseDeps } from "../src/firebase.js";

const [target, flag] = process.argv.slice(2);
if (!target) { console.error("Usage: set-banker-claim.ts <email-or-uid> [--remove]"); process.exit(1); }

firebaseDeps(loadEnv()); // initialises the admin app
const auth = getAuth();
const user = target.includes("@") ? await auth.getUserByEmail(target) : await auth.getUser(target);
await auth.setCustomUserClaims(user.uid, { ...user.customClaims, role: flag === "--remove" ? null : "banker" });
console.log(`${flag === "--remove" ? "Removed" : "Set"} banker claim for ${user.uid}. User must re-login to refresh the token.`);
