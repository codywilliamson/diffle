import { resolve } from "node:path";
import { productEnv } from "../utils/env";
import { launchReview, type ReviewLaunch } from "../core/reviewLaunch";
import { classifySessions } from "../core/sessions";
import {
  cancelReview, markCommentAddressed, readReviewRecord, replyToComment,
  requestRereview,
} from "../core/reviewRecords";
import { DEFAULT_WAIT_SECONDS, waitForComments } from "../core/reviewInbox";
import { addAgentComment } from "../core/agentComments";
import type { ReviewOperationResult, ReviewOperations } from "./operations";
import { scorecardForReview } from "./scorecardOperation";

function found(reviewId: string): ReviewOperationResult {
  const review = readReviewRecord(reviewId);
  if (!review) throw new Error("review record not found");
  return { review };
}

export function createReviewOperations(loupeRoot: string): ReviewOperations {
  const launches = new Map<string, ReviewLaunch>();
  return {
    async startReview(input) {
      const launch = launchReview({
        cwd: resolve(input.cwd), loupeRoot, spec: input.ref, policy: input.policy ?? "required",
        open: productEnv("NO_OPEN") !== "1", requireChanges: true, host: "mcp",
        ...(input.origin ? { origin: input.origin } : {}),
      });
      launches.set(launch.review.id, launch);
      const { stale } = await classifySessions();
      return { review: launch.review, url: launch.url, staleSessions: stale.length };
    },
    async getReview(reviewId) { return found(reviewId); },
    async getScorecard(reviewId) { return scorecardForReview(reviewId); },
    async waitForComments(input, signal) {
      return waitForComments(input.reviewId, (input.timeoutSeconds ?? DEFAULT_WAIT_SECONDS) * 1000, signal);
    },
    async addComment({ reviewId, ...input }) { return { review: addAgentComment(reviewId, input) }; },
    async replyToComment(input) {
      return { review: replyToComment(input.reviewId, input.commentId, input.text, "agent") };
    },
    async markCommentAddressed(input) {
      return { review: markCommentAddressed(input.reviewId, input.commentId) };
    },
    async requestRereview(input) {
      return { review: requestRereview(input.reviewId, input.summary) };
    },
    async cancelReview(input) { return { review: cancelReview(input.reviewId, input.summary) }; },
    stopAll() {
      for (const launch of launches.values()) launch.stop();
      launches.clear();
    },
  };
}
