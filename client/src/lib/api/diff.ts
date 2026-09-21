import type { DiffResult } from "$types";
import { apiGet } from "./http";

// GET /api/diff → the current DiffResult; the server re-runs git diff on each call.
export function getDiff(signal?: AbortSignal): Promise<DiffResult> {
  return apiGet<DiffResult>("/api/diff", signal);
}
