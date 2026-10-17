import type { AuthUser } from "./auth.js";
import type { Store } from "./store.js";

/**
 * Writes applications/{appId}/audit {at, actor, action, detail} (SPEC).
 * Never put secrets, OTPs, raw answers or full ID numbers in `detail`.
 */
export async function audit(store: Store, actor: AuthUser | "system", action: string, appId: string, detail: Record<string, unknown> = {}) {
  return store.add(`applications/${appId}/audit`, {
    at: new Date().toISOString(),
    actor: actor === "system" ? "system" : actor.uid,
    action,
    detail,
  });
}
