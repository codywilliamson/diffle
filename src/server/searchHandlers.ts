// GET /api/search?q=&regex=0|1&case=smart|sensitive|insensitive — search both sides of every text file in the diff.
// literal queries run in-process (linear time); regex queries run in a worker that is killed on timeout.

import type { SearchCase, SearchResponse, SearchSide } from "../types";
import { compilePattern, SearchPatternError } from "../core/search";
import { searchDiffFiles, targetsFor, type SideReader } from "../core/searchDiff";
import { oldSideRef } from "../core/searchBase";
import { runSearchInWorker, SearchTimeoutError } from "../core/searchRunner";
import { runGitBytes } from "../utils/git";
import { insideDir, isAbsolutePath } from "../utils/pathWithin";
import type { ServerContext } from "./handlers";
import { readNewSide } from "./fileHandlers";
import { apiError, json } from "./respond";

const CASE_MODES: readonly SearchCase[] = ["smart", "sensitive", "insensitive"];
const UNPROCESSABLE = 422;

const isSafePath = (ctx: ServerContext, path: string) => !path.includes("..") && !isAbsolutePath(path) && insideDir(ctx.cwd, path);

// old side: the base blob; new side: working tree or the new ref. unreadable or escaping paths read as missing.
function sideReader(ctx: ServerContext): SideReader {
  const base = oldSideRef(ctx.diffArgs, ctx.cwd);
  return (path: string, side: SearchSide) => {
    if (!isSafePath(ctx, path)) return null;
    try {
      if (side === "new") return readNewSide(ctx, path);
      return base === null ? null : runGitBytes(["show", `${base}:${path}`], ctx.cwd);
    } catch {
      return null;
    }
  };
}

// regex mode ships every side's bytes to the worker, which can't reach the repo itself.
function searchInWorker(ctx: ServerContext, query: string, caseMode: SearchCase): Promise<SearchResponse> {
  const read = sideReader(ctx);
  const contents: Record<string, Uint8Array> = {};
  for (const file of ctx.diff.files) {
    for (const { path, side } of targetsFor(file)) {
      const bytes = read(path, side);
      if (bytes) contents[`${side}:${path}`] = new Uint8Array(bytes);
    }
  }
  return runSearchInWorker({ files: ctx.diff.files, contents, query, caseMode });
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
    return json(isRegex ? await searchInWorker(ctx, query, caseMode) : searchDiffFiles(ctx.diff.files, sideReader(ctx), pattern));
  } catch (error) {
    if (error instanceof SearchPatternError) return apiError(error.message, 400);
    if (error instanceof SearchTimeoutError) return apiError(error.message, UNPROCESSABLE);
    return apiError(error instanceof Error ? error.message : "search failed", 500);
  }
}
