import { ApiError } from "./api";

export type ErrorKey = "notConfigured" | "signInFailed" | "netError" | "offline" | "genericError";

/**
 * Which message to show for a failed API call.
 *
 * Status 0 covers two very different faults that used to share one message ("check your internet"):
 * the server could not be reached at all, and Firebase refused to sign the user in (usually because
 * the site's domain is not in Firebase's authorised domains). Telling them apart is the difference
 * between a backend problem and a console setting, so they get separate text.
 */
export function errorKey(e: unknown): ErrorKey {
  if (!(e instanceof ApiError)) return "genericError";
  if (e.status === -1) return "notConfigured";
  if (e.status !== 0) return "genericError";
  if (!navigator.onLine) return "offline";
  return e.code === "auth_failed" ? "signInFailed" : "netError";
}
