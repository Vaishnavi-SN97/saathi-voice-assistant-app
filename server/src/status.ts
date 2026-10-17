// SPEC: draft -> docs_pending -> needs_fix -> ready_for_review -> approved | sent_back -> signed (sent_back -> needs_fix)
export const STATUSES = ["draft", "docs_pending", "needs_fix", "ready_for_review", "approved", "sent_back", "signed"] as const;
export type Status = (typeof STATUSES)[number];

export const TRANSITIONS: Record<Status, Status[]> = {
  draft: ["docs_pending"],
  docs_pending: ["needs_fix", "ready_for_review"],
  needs_fix: ["ready_for_review"],
  ready_for_review: ["approved", "sent_back", "needs_fix"],
  approved: ["signed"],
  sent_back: ["needs_fix"],
  signed: [],
};

export const canTransition = (from: Status, to: Status) => TRANSITIONS[from]?.includes(to) ?? false;

export function assertTransition(from: Status, to: Status) {
  if (!canTransition(from, to)) throw new Error(`Illegal status transition ${from} -> ${to}`);
}
