import { buildMismatches, type AppLike, type Mismatch } from "./mismatches.js";
import { computeReadiness, type Readiness } from "./readiness.js";

export interface Evaluation { mismatches: Mismatch[]; readiness: Readiness; blocking: boolean; eligible: boolean }

/** One source of truth for "can this application be submitted": no blocking mismatch and every required answer confirmed. */
export function evaluate(app: AppLike): Evaluation {
  const mismatches = buildMismatches(app);
  const readiness = computeReadiness(app);
  const blocking = mismatches.some((m) => m.severity === "block");
  const eligible = !blocking && readiness.items.find((i) => i.id === "answers")!.done;
  return { mismatches, readiness, blocking, eligible };
}
