import type { ReviewOutcomeRequest, ReviewRecord } from "$types";
import { apiGet, apiPost } from "./http";

type ReviewOutcome = ReviewOutcomeRequest["outcome"];
// the reviewer may resolve or reopen; marking "addressed" is an agent-only (mcp) action.
export type ReviewerStatus = "resolved" | "open";

export function getReview(id: string, signal?: AbortSignal): Promise<ReviewRecord> {
  return apiGet<ReviewRecord>(`/api/review?id=${encodeURIComponent(id)}`, signal);
}

export function submitReviewOutcome(
  id: string,
  outcome: ReviewOutcome,
  summary?: string,
  acknowledgeUnresolved = false,
  signal?: AbortSignal,
): Promise<ReviewRecord> {
  return apiPost<ReviewRecord>("/api/review/outcome", { id, outcome, summary, acknowledgeUnresolved }, signal);
}

export function resolveReviewComment(id: string, commentId: string, status: ReviewerStatus, signal?: AbortSignal): Promise<ReviewRecord> {
  return apiPost<ReviewRecord>("/api/review/status", { id, commentId, status }, signal);
}

export function replyToReviewComment(id: string, commentId: string, text: string, signal?: AbortSignal): Promise<ReviewRecord> {
  return apiPost<ReviewRecord>("/api/review/reply", { id, commentId, text }, signal);
}

// legacy .review discovery + adoption. a discovered file is imported, ignored, or removed —
// never silently changed.
export function detectLegacyReview(signal?: AbortSignal): Promise<{ present: boolean }> {
  return apiGet<{ present: boolean }>("/api/review/legacy", signal);
}

export function importLegacyReview(id: string, signal?: AbortSignal): Promise<ReviewRecord> {
  return apiPost<ReviewRecord>("/api/review/legacy", { action: "import", id }, signal);
}

export function ignoreLegacyReview(signal?: AbortSignal): Promise<{ legacy: boolean; ignored: true }> {
  return apiPost<{ legacy: boolean; ignored: true }>("/api/review/legacy", { action: "ignore" }, signal);
}

export function removeLegacyReview(confirm = false, signal?: AbortSignal): Promise<{ removed: boolean }> {
  return apiPost<{ removed: boolean }>("/api/review/legacy", { action: "remove", confirm }, signal);
}
