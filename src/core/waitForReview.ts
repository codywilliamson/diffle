// blocks until a review reaches a hand-off point: feedback returned, approved, cancelled, or the
// last browser tab closed. driven by the in-process save notification and the tab presence
// stream, so nothing polls.

import type { ReviewStatus } from "../types";
import type { Presence } from "../server/presence";
import { onReviewSaved } from "./reviewEvents";
import { readReviewRecord } from "./reviewRecords";

export type WaitOutcome = "feedback" | "approved" | "cancelled" | "closed";

// a reload drops the stream for a moment; waiting this long before calling it closed rides that out.
export const TAB_CLOSE_GRACE_MS = 5_000;

const OUTCOME_BY_STATUS: Partial<Record<ReviewStatus, WaitOutcome>> = {
  feedback_ready: "feedback",
  approved: "approved",
  cancelled: "cancelled",
};

export interface WaitInput {
  reviewId: string;
  presence: Presence;
  graceMs?: number;
}

const outcomeOf = (reviewId: string): WaitOutcome | undefined => {
  const status = readReviewRecord(reviewId)?.status;
  return status ? OUTCOME_BY_STATUS[status] : undefined;
};

export function waitForReview({ reviewId, presence, graceMs = TAB_CLOSE_GRACE_MS }: WaitInput): Promise<WaitOutcome> {
  return new Promise((resolve) => {
    let grace: ReturnType<typeof setTimeout> | undefined;
    const stops: Array<() => void> = [];
    const finish = (outcome: WaitOutcome) => {
      clearTimeout(grace);
      for (const stop of stops) stop();
      resolve(outcome);
    };
    const checkRecord = () => { const outcome = outcomeOf(reviewId); if (outcome) finish(outcome); };
    const checkTabs = () => {
      if (presence.count() > 0) { clearTimeout(grace); grace = undefined; return; }
      if (!presence.everConnected() || grace) return; // never opened yet, or already counting down
      grace = setTimeout(() => finish(outcomeOf(reviewId) ?? "closed"), graceMs);
    };
    stops.push(onReviewSaved(reviewId, checkRecord), presence.onChange(checkTabs));
    checkRecord();
  });
}
