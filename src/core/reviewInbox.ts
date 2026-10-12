// the interactive review inbox: which comments still wait on the agent, and a bounded wait for
// them. a comment waits when it is unresolved and someone other than the agent spoke last —
// the comment itself is its author's first message, so an addressed comment with no replies,
// or an agent's own comment nobody answered, does not wait.

import type { Comment, ReviewRecord } from "../types";
import { readReviewRecord } from "./reviewRecords";

export const DEFAULT_WAIT_SECONDS = 540; // stays well under the mcp client idle timeout
export const MAX_WAIT_SECONDS = 600;
const POLL_INTERVAL_MS = 1000;

export interface InboxResult {
  [key: string]: unknown;
  review: ReviewRecord;
  pending: Comment[];
  timedOut: boolean;
}

export function pendingComments(record: ReviewRecord): Comment[] {
  return record.comments.filter((comment) => {
    const status = comment.status ?? (comment.resolved ? "resolved" : "open");
    if (status === "resolved") return false;
    const last = comment.replies?.at(-1);
    if (last) return last.author !== "agent";
    return comment.author !== "agent" && status === "open";
  });
}

// returns as soon as a comment waits or the review leaves awaiting_human (feedback returned,
// approved, cancelled); otherwise returns empty once the timeout passes or the caller aborts.
export async function waitForComments(reviewId: string, timeoutMs: number, signal?: AbortSignal, pollMs = POLL_INTERVAL_MS): Promise<InboxResult> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const review = readReviewRecord(reviewId);
    if (!review) throw new Error("review record not found");
    const pending = pendingComments(review);
    if (pending.length > 0 || review.status !== "awaiting_human") return { review, pending, timedOut: false };
    const left = deadline - Date.now();
    if (left <= 0 || signal?.aborted) return { review, pending, timedOut: true };
    await Bun.sleep(Math.min(pollMs, left));
  }
}
