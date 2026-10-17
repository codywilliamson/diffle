// GET /api/search?q=&regex=0|1&case=smart|sensitive|insensitive — search both sides of every text file in the diff.
// literal queries run in-process (linear time); regex queries run in a worker that is killed on timeout.

import type { SearchCase, SearchResponse } from "../types";
import { compilePattern, SearchPatternError } from "../core/search";
import { collectSides, readerFor } from "../core/searchCollect";
import { searchDiffFiles } from "../core/searchDiff";
import { runSearchInWorker, SearchBusyError, SearchTimeoutError, SEARCH_TOTAL_BUDGET_MS, withSearchSlot } from "../core/searchRunner";
import type { ServerContext } from "./handlers";
import { searchSource } from "./searchSource";
import { apiError, json } from "./respond";

const CASE_MODES: readonly SearchCase[] = ["smart", "sensitive", "insensitive"];
const UNPROCESSABLE = 422;
const TOO_MANY_REQUESTS = 429;

// regex mode: wait for a slot, then read everything under the same clock the worker runs on.
function searchInWorker(ctx: ServerContext, query: string, caseMode: SearchCase): Promise<SearchResponse> {
  return withSearchSlot(async () => {
    const started = performance.now();
    const collected = collectSides(ctx.diff.files, searchSource(ctx), started + SEARCH_TOTAL_BUDGET_MS);
    const remaining = SEARCH_TOTAL_BUDGET_MS - (performance.now() - started);
    if (remaining <= 0) throw new SearchTimeoutError("preparing the search took too long; try again");
    const response = await runSearchInWorker({ files: ctx.diff.files, contents: collected.contents, query, caseMode }, remaining);
    return { ...response, truncated: response.truncated || collected.truncated };
  });
}

function searchInProcess(ctx: ServerContext, pattern: ReturnType<typeof compilePattern>): SearchResponse {
  const collected = collectSides(ctx.diff.files, searchSource(ctx), performance.now() + SEARCH_TOTAL_BUDGET_MS);
  const response = searchDiffFiles(ctx.diff.files, readerFor(collected.contents), pattern);
  return { ...response, truncated: response.truncated || collected.truncated };
}

export async function handleGetSearch(ctx: ServerContext, url: URL): Promise<Response> {
  const query = url.searchParams.get("q") ?? "";
  if (!query.trim()) return apiError("q is required", 400);
  const caseParam = url.searchParams.get("case") ?? "smart";
  if (!CASE_MODES.includes(caseParam as SearchCase)) return apiError("case must be smart, sensitive or insensitive", 400);
  const caseMode = caseParam as SearchCase;
  const isRegex = url.searchParams.get("regex") === "1";
  try {
    const pattern = compilePattern(query, isRegex, caseMode);
    return json(isRegex ? await searchInWorker(ctx, query, caseMode) : searchInProcess(ctx, pattern));
  } catch (error) {
    if (error instanceof SearchPatternError) return apiError(error.message, 400);
    if (error instanceof SearchBusyError) return apiError(error.message, TOO_MANY_REQUESTS);
    if (error instanceof SearchTimeoutError) return apiError(error.message, UNPROCESSABLE);
    return apiError(error instanceof Error ? error.message : "search failed", 500);
  }
}
