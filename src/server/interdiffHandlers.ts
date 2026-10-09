// GET /api/interdiff?path= — what changed in one file since the reviewer's last returned feedback.

import type { InterdiffResponse } from "../types";
import { readReviewRecord } from "../core/reviewRecords";
import { interdiffFor } from "../core/reviewRounds";
import type { ServerContext } from "./handlers";
import { apiError, json } from "./respond";

export function handleGetInterdiff(ctx: ServerContext, url: URL): Response {
  const path = url.searchParams.get("path");
  if (!path) return apiError("path is required", 400);
  const round = ctx.reviewId ? readReviewRecord(ctx.reviewId)?.lastRound : undefined;
  if (!round) return apiError("no previous review round", 404);
  if (!ctx.diff.files.some((file) => file.path === path)) return apiError("path is not in the diff", 400);
  try {
    return json({ path, file: interdiffFor(round, path, ctx.cwd, ctx.newRef) } satisfies InterdiffResponse);
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "interdiff failed", 500);
  }
}
