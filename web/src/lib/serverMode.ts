import { useEffect, useState } from "react";
import { API_BASE } from "./api";

export interface ServerMode { reachable: boolean; mockAi: boolean }

let cached: Promise<ServerMode> | null = null;

/** GET /health once per page load (no token needed). */
export function serverMode(): Promise<ServerMode> {
  cached ??= fetch(`${API_BASE}/health`)
    .then(async (r) => {
      const j = (await r.json()) as { ok?: boolean; mockAi?: boolean };
      return { reachable: r.ok && j.ok === true, mockAi: j.mockAi === true };
    })
    .catch(() => ({ reachable: false, mockAi: false }));
  return cached;
}

/**
 * Tells the screens whether the server is answering and whether it is running on canned AI.
 * Mock mode must be visible: otherwise a demo looks broken (the microphone returns a fixed line,
 * the voices are silent and only the printed sample documents can be read).
 */
export function useServerMode(): ServerMode | null {
  const [mode, setMode] = useState<ServerMode | null>(null);
  useEffect(() => {
    let alive = true;
    void serverMode().then((m) => alive && setMode(m));
    return () => { alive = false; };
  }, []);
  return mode;
}
