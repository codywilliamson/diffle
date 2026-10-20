import type { CommentDrafts, DraftUpdateRequest, DraftsResponse } from "$types";
import { apiGet, apiPost } from "./http";

export async function getDrafts(signal?: AbortSignal): Promise<CommentDrafts> {
  return (await apiGet<DraftsResponse>("/api/drafts", signal)).drafts;
}

// empty text removes the draft.
export function saveDraft(key: string, text: string, signal?: AbortSignal): Promise<DraftsResponse> {
  return apiPost<DraftsResponse>("/api/drafts", { key, text } satisfies DraftUpdateRequest, signal);
}
