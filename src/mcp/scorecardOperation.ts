// get_scorecard: the same deterministic scorecard the reviewer sees, computed for a review's target.

import type { ReviewScorecard } from "../types";
import { analyzeDiff, churnBaseFor } from "../core/analysis/analyzeDiff";
import { readReviewRecord } from "../core/reviewRecords";
import { loadReviewTarget } from "../core/reviewTarget";

export function scorecardForReview(reviewId: string): ReviewScorecard {
  const record = readReviewRecord(reviewId);
  if (!record) throw new Error("review record not found");
  const { cwd, spec } = record.target;
  const loaded = loadReviewTarget(cwd, spec);
  if (loaded.mode === "browse") throw new Error("scorecard is only available for diffs");
  return analyzeDiff(loaded.diff, { cwd, newRef: loaded.newRef, churnBase: churnBaseFor(loaded.meta), round: record.lastRound });
}
