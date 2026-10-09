import type { ReviewOrigin, ReviewPolicy, ReviewRecord, ReviewScorecard } from "../types";

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
  replyToComment(input: { reviewId: string; commentId: string; text: string }): Promise<ReviewOperationResult>;
  markCommentAddressed(input: { reviewId: string; commentId: string }): Promise<ReviewOperationResult>;
  requestRereview(input: { reviewId: string; summary?: string }): Promise<ReviewOperationResult>;
  cancelReview(input: { reviewId: string; summary?: string }): Promise<ReviewOperationResult>;
  stopAll(): void; // stops every server this process launched; called on shutdown
}

export interface McpRootProvider {
  getRoots(): Promise<string[]>;
}
