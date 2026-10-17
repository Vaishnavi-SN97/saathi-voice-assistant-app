import { getIdToken, NotConfiguredError } from "./firebase";

const BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:8080").replace(/\/$/, "");

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
}

/**
 * Calls the Saathi API with the Firebase ID token. Throws ApiError (status 0 = network, -1 = not configured).
 * A 401 triggers one retry with a force-refreshed token (covers a stale or just-expired token).
 */
export async function api<T = unknown>(path: string, opts: Options = {}): Promise<T> {
  const send = async (forceRefresh: boolean): Promise<Response> => {
    let token: string;
    try {
      token = await getIdToken(forceRefresh);
    } catch (e) {
      if (e instanceof NotConfiguredError) throw new ApiError(-1, "not_configured", e.message);
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

  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.code ?? "error", data?.error ?? `Request failed (${res.status})`);
  return data as T;
}
