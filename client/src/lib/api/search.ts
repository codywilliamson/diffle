import type { SearchResponse } from "$types";
import { apiGet } from "./http";

// GET /api/search → hits in every text file of the diff. case stays on the server's smartcase default.
export function searchAllFiles(query: string, regex: boolean, signal?: AbortSignal): Promise<SearchResponse> {
  const params = new URLSearchParams({ q: query, regex: regex ? "1" : "0" });
  return apiGet<SearchResponse>(`/api/search?${params}`, signal);
}
