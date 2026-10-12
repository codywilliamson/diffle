import type { ReviewOrigin, ReviewPolicy, ReviewRecord, ReviewScorecard } from "../types";
import type { InboxResult } from "../core/reviewInbox";
import type { AgentCommentInput } from "../core/agentComments";

export interface StartReviewInput {
  cwd: string;
  ref: string;
  policy?: ReviewPolicy;
  origin?: ReviewOrigin;
}

export interface ReviewOperationResult {
  [key: string]: unknown;
  review: ReviewRecord;
  url?: string;
  staleSessions?: number; // count of stale/orphaned loupe sessions found at start_review time
}

export interface ReviewOperations {
  startReview(input: StartReviewInput): Promise<ReviewOperationResult>;
  getReview(reviewId: string): Promise<ReviewOperationResult>;
  getScorecard(reviewId: string): Promise<ReviewScorecard>;
  waitForComments(input: { reviewId: string; timeoutSeconds?: number }, signal?: AbortSignal): Promise<InboxResult>;
  addComment(input: AgentCommentInput & { reviewId: string }): Promise<ReviewOperationResult>;
  replyToComment(input: { reviewId: string; commentId: string; text: string }): Promise<ReviewOperationResult>;
  markCommentAddressed(input: { reviewId: string; commentId: string }): Promise<ReviewOperationResult>;
  requestRereview(input: { reviewId: string; summary?: string }): Promise<ReviewOperationResult>;
  cancelReview(input: { reviewId: string; summary?: string }): Promise<ReviewOperationResult>;
  stopAll(): void; // stops every server this process launched; called on shutdown
}

export interface McpRootProvider {
  getRoots(): Promise<string[]>;
}
