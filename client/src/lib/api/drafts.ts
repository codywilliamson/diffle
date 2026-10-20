import type { CommentDrafts, DraftBatchRequest, DraftUpdate, DraftsResponse } from "$types";
import { apiGet, apiPost } from "./http";

export async function getDrafts(signal?: AbortSignal): Promise<CommentDrafts> {
  return (await apiGet<DraftsResponse>("/api/drafts", signal)).drafts;
}

// every update is applied on its own; empty text removes a draft. keepalive is for unload flushes.
export function saveDrafts(updates: DraftUpdate[], keepalive = false, signal?: AbortSignal): Promise<DraftsResponse> {
  return apiPost<DraftsResponse>("/api/drafts", { updates } satisfies DraftBatchRequest, signal, undefined, keepalive);
}
