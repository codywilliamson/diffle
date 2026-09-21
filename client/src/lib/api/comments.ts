import type { Comment, CommentsUpdateRequest, ReviewFile, ReviewRecord, ViewedUpdateRequest } from "$types";
import { apiGet, apiPost } from "./http";

// the durable record (agent-connected) or the legacy .review file (manual mode)
export type CommentsResponse = ReviewRecord | ReviewFile;

// GET /api/comments → the record, the legacy file, or null when neither exists yet.
export async function getComments(signal?: AbortSignal): Promise<CommentsResponse | null> {
  const data = await apiGet<CommentsResponse | Record<string, never>>("/api/comments", signal);
  return "comments" in data ? (data as CommentsResponse) : null;
}

// full replace of the comments array; the server merges agent-owned fields (replies/status) back in.
export function saveComments(comments: Comment[], signal?: AbortSignal): Promise<CommentsResponse> {
  return apiPost<CommentsResponse>("/api/comments", { comments } satisfies CommentsUpdateRequest, signal);
}

// full replace of the viewed-paths array.
export function saveViewed(viewed: string[], signal?: AbortSignal): Promise<CommentsResponse> {
  return apiPost<CommentsResponse>("/api/viewed", { viewed } satisfies ViewedUpdateRequest, signal);
}
