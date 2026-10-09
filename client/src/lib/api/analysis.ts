import type { InterdiffResponse, ReviewScorecard } from "$types";
import { apiGet } from "./http";

// GET /api/scorecard → deterministic analysis of the current diff (order, noise, flags, bands).
export function getScorecard(signal?: AbortSignal): Promise<ReviewScorecard> {
  return apiGet<ReviewScorecard>("/api/scorecard", signal);
}

// GET /api/interdiff → one file's changes since the reviewer's last round.
export function getInterdiff(path: string, signal?: AbortSignal): Promise<InterdiffResponse> {
  return apiGet<InterdiffResponse>(`/api/interdiff?path=${encodeURIComponent(path)}`, signal);
}
