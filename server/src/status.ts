export const STATUSES = ["draft", "docs_pending", "submitted", "in_review", "needs_info", "approved", "rejected", "disbursed"] as const;
export type Status = (typeof STATUSES)[number];

export const TRANSITIONS: Record<Status, Status[]> = {
  draft: ["docs_pending"],
  docs_pending: ["submitted"],
  submitted: ["in_review"],
  in_review: ["approved", "rejected", "needs_info"],
  needs_info: ["submitted"],
  approved: ["disbursed"],
  rejected: [],
  disbursed: [],
};

export const canTransition = (from: Status, to: Status) => TRANSITIONS[from]?.includes(to) ?? false;

export function assertTransition(from: Status, to: Status) {
  if (!canTransition(from, to)) throw new Error(`Illegal status transition ${from} -> ${to}`);
}
