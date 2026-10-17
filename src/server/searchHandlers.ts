// GET /api/search?q=&regex=0|1&case=smart|sensitive|insensitive — search both sides of every text file in the diff.

import type { SearchCase, SearchSide } from "../types";
import { compilePattern, SearchPatternError } from "../core/search";
import { searchDiffFiles, type SideReader } from "../core/searchDiff";
import { oldSideRef } from "../core/searchBase";
import { runGitBytes } from "../utils/git";
import { insideDir, isAbsolutePath } from "../utils/pathWithin";
import type { ServerContext } from "./handlers";
import { readNewSide } from "./fileHandlers";
import { apiError, json } from "./respond";

const CASE_MODES: readonly SearchCase[] = ["smart", "sensitive", "insensitive"];

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

export function handleGetSearch(ctx: ServerContext, url: URL): Response {
  const query = url.searchParams.get("q") ?? "";
  if (!query.trim()) return apiError("q is required", 400);
  const caseParam = url.searchParams.get("case") ?? "smart";
  if (!CASE_MODES.includes(caseParam as SearchCase)) return apiError("case must be smart, sensitive or insensitive", 400);
  try {
    const pattern = compilePattern(query, url.searchParams.get("regex") === "1", caseParam as SearchCase);
    return json(searchDiffFiles(ctx.diff.files, sideReader(ctx), pattern));
  } catch (error) {
    if (error instanceof SearchPatternError) return apiError(error.message, 400);
    return apiError(error instanceof Error ? error.message : "search failed", 500);
  }
}
