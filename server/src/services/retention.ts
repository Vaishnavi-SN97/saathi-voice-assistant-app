import { audit } from "../audit.js";
import { FILE_KINDS } from "../fileStore.js";
import type { Store } from "../store.js";

export const DEFAULT_RETENTION_DAYS = 7;

/** ID photos are removed once the application is signed; the signed PDF and signature stay as the record. */
export const PHOTO_KINDS = ["aadhaar", "pan", "passbook"] as const;
/** Never submitted (or sent back and then left alone): removed after RETENTION_DAYS without activity. */
const ABANDONABLE = new Set(["draft", "docs_pending", "needs_fix", "sent_back"]);

export interface RetentionResult { photosDeleted: number; applicationsDeleted: number; checked: number }

/** Deletes an application and everything under it (files, audit). */
export async function deleteApplication(store: Store, id: string) {
  for (const kind of FILE_KINDS) await store.delete(`applications/${id}/files/${kind}`);
  for (const a of await store.list(`applications/${id}/audit`)) await store.delete(`applications/${id}/audit/${a.id}`);
  await store.delete(`applications/${id}`);
}

/**
 * Retention cleanup (idempotent, safe to run any time):
 *  1. signed applications: delete the Aadhaar / PAN / passbook photos;
 *  2. abandoned applications (draft, docs_pending, needs_fix, sent_back) idle for more than `days`: delete them entirely.
 * Seeded demo rows (`demo: true`) are never touched.
 */
export async function runRetention(store: Store, opts: { days?: number; now?: Date } = {}): Promise<RetentionResult> {
  const days = opts.days ?? DEFAULT_RETENTION_DAYS;
  const cutoff = (opts.now ?? new Date()).getTime() - days * 86_400_000;
  const apps = await store.list("applications");
  const out: RetentionResult = { photosDeleted: 0, applicationsDeleted: 0, checked: apps.length };

  for (const { id, data: app } of apps) {
    if (app.demo === true) continue;

    if (app.status === "signed") {
      let n = 0;
      for (const kind of PHOTO_KINDS) {
        if (await store.get(`applications/${id}/files/${kind}`)) { await store.delete(`applications/${id}/files/${kind}`); n++; }
      }
      if (n) {
        out.photosDeleted += n;
        await store.set(`applications/${id}`, { ...app, filesDeletedAt: new Date().toISOString() });
        await audit(store, "system", "retention.photos_deleted", id, { count: n });
      }
      continue;
    }

    if (ABANDONABLE.has(app.status)) {
      const last = Date.parse(app.updatedAt ?? app.createdAt ?? app.metrics?.startedAt ?? "");
      if (Number.isFinite(last) && last < cutoff) {
        await deleteApplication(store, id);
        out.applicationsDeleted++;
      }
    }
  }
  return out;
}
