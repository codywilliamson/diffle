import type { CompilePromptResponse, FileContentResponse, StateUpdateRequest, UpdateStatus, UserState } from "$types";
import { apiGet, apiPost } from "./http";

// GET /api/compile → the compiled review prompt; an explicit summary overrides the record's.
export function compile(summary?: string, signal?: AbortSignal): Promise<CompilePromptResponse> {
  const query = summary?.trim() ? `?summary=${encodeURIComponent(summary)}` : "";
  return apiGet<CompilePromptResponse>(`/api/compile${query}`, signal);
}

export function getUpdate(signal?: AbortSignal): Promise<UpdateStatus> {
  return apiGet<UpdateStatus>("/api/update", signal);
}

// UserState persists in the data dir (state.json), surviving the per-launch random port.
export function getState(signal?: AbortSignal): Promise<UserState> {
  return apiGet<UserState>("/api/state", signal);
}

export function saveState(patch: StateUpdateRequest, signal?: AbortSignal): Promise<UserState> {
  return apiPost<UserState>("/api/state", patch, signal);
}

export function getFile(path: string, signal?: AbortSignal): Promise<FileContentResponse> {
  return apiGet<FileContentResponse>(`/api/file?path=${encodeURIComponent(path)}`, signal);
}

// url serving a repo file's raw bytes (markdown images) — referenced directly, not fetched.
export function rawUrl(path: string): string {
  return `/api/raw?path=${encodeURIComponent(path)}`;
}
