import type { AuthUser } from "./auth.js";
import type { Store } from "./store.js";

export async function audit(store: Store, actor: AuthUser | null, action: string, appId?: string, meta: Record<string, unknown> = {}) {
  return store.add("audit", {
    at: new Date().toISOString(),
    actorUid: actor?.uid ?? null,
    role: actor?.role ?? null,
    action,
    appId: appId ?? null,
    meta,
  });
}
