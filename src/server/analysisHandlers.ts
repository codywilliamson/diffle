// GET /api/scorecard — the deterministic review scorecard for the current diff.

import { analyzeDiff, churnBaseFor } from "../core/analysis/analyzeDiff";
import { readReviewRecord } from "../core/reviewRecords";
import type { ServerContext } from "./handlers";
import { apiError, json } from "./respond";

export function handleGetScorecard(ctx: ServerContext): Response {
  if (ctx.mode === "browse") return apiError("scorecard is only available for diffs", 404);
  try {
    const round = ctx.reviewId ? readReviewRecord(ctx.reviewId)?.lastRound : undefined;
    const churnBase = churnBaseFor(ctx.meta ?? ctx.diff.meta);
    return json(analyzeDiff(ctx.diff, { cwd: ctx.cwd, newRef: ctx.newRef, churnBase, round }));
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "scorecard failed", 500);
  }
}
