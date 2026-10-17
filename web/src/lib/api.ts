import { getIdToken, NotConfiguredError } from "./firebase";

const CONFIGURED = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
/**
 * Where the API lives. VITE_API_URL is baked in at BUILD time, so changing it needs a rebuild.
 * Empty means same origin, which is exactly right when the server serves this build itself
 * (SERVE_WEB=true): one URL, and no CORS. A local default exists only for `npm run dev`.
 */
export const API_BASE = (CONFIGURED || (import.meta.env.DEV ? "http://localhost:8080" : "")).replace(/\/$/, "");
const BASE = API_BASE;
if (!API_BASE && !import.meta.env.DEV) console.info("VITE_API_URL is not set: calling the API on this same origin.");

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

/** Server returns relative media URLs ("/media/..."); make them absolute. */
export const absUrl = (p: string) => (/^https?:/.test(p) ? p : BASE + p);

interface Options {
  method?: "GET" | "POST";
  json?: unknown;
  form?: FormData;
  signal?: AbortSignal;
  /** Where the Bearer token comes from. Default: the customer's anonymous Firebase user; the banker app passes its own. */
  tokenProvider?: (forceRefresh: boolean) => Promise<string>;
  /** Return the raw Response body as a Blob (images, PDF) instead of JSON. */
  blob?: boolean;
}

/**
 * Calls the Saathi API with the Firebase ID token. Throws ApiError (status 0 = network, -1 = not configured).
 * A 401 triggers one retry with a force-refreshed token (covers a stale or just-expired token).
 */
export async function api<T = unknown>(path: string, opts: Options = {}): Promise<T> {
  const getToken = opts.tokenProvider ?? getIdToken;
  const send = async (forceRefresh: boolean): Promise<Response> => {
    let token: string;
    try {
      token = await getToken(forceRefresh);
    } catch (e) {
      if (e instanceof NotConfiguredError) throw new ApiError(-1, "not_configured", e.message);
      // The console line is the only place the real cause is visible; auth/unauthorized-domain means
      // this site's domain is missing from Firebase Authentication -> Settings -> Authorised domains.
      const code = (e as { code?: string } | null)?.code;
      console.error(`Firebase sign-in failed${code ? ` (${code})` : ""}. If the code is auth/unauthorized-domain, add ${location.hostname} to Firebase Authentication -> Settings -> Authorised domains.`);
      throw new ApiError(0, "auth_failed", "Could not sign in");
    }

    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    let body: BodyInit | undefined;
    if (opts.form) body = opts.form;
    else if (opts.json !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(opts.json);
    }
    try {
      return await fetch(BASE + path, { method: opts.method ?? (body ? "POST" : "GET"), headers, body, signal: opts.signal });
    } catch {
      throw new ApiError(0, "network", "Cannot reach the server");
    }
  };

  let res = await send(false);
  if (res.status === 401) res = await send(true);

  if (opts.blob && res.ok) return (await res.blob()) as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.code ?? "error", data?.error ?? `Request failed (${res.status})`);
  return data as T;
}
