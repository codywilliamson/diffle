// reviewer comment commands, derived from the review store's record + the current diff.
// every mutation treats the server response as the next authoritative record and adopts it
// back into the review store, so the two compose without a shared global.

import type { Comment, DiffResult } from "$types";
import { saveComments, saveViewed, type CommentsResponse } from "$lib/api/comments";
import { resolveReviewComment, replyToReviewComment } from "$lib/api/review";
import { partitionComments } from "$lib/anchor";
import { isRecord, isResolved, commentsOf, errorMessage } from "./reviewRecord";
import type { ReviewStore } from "./review.svelte";

const EMPTY_DIFF: DiffResult = { ref: "", files: [] };

export interface CommentsDeps {
  saveComments: (comments: Comment[], signal?: AbortSignal) => Promise<CommentsResponse>;
  saveViewed: (viewed: string[], signal?: AbortSignal) => Promise<CommentsResponse>;
  resolveReviewComment: typeof resolveReviewComment;
  replyToReviewComment: typeof replyToReviewComment;
}

const realDeps: CommentsDeps = { saveComments, saveViewed, resolveReviewComment, replyToReviewComment };

export function createCommentsStore(
  review: ReviewStore,
  getCurrentDiff: () => DiffResult | null,
  deps: CommentsDeps = realDeps,
) {
  let error = $state<string | null>(null);

  const comments = (): Comment[] => commentsOf(review.record);
  const viewed = (): string[] => {
    const r = review.record;
    return r ? r.viewed : [];
  };

  // save the full comments array and adopt whatever record the server returns.
  async function persist(next: Comment[]): Promise<string | null> {
    error = null;
    try {
      review.adopt(await deps.saveComments(next));
      return null;
    } catch (e) {
      error = errorMessage(e);
      return error;
    }
  }

  // toggle a file's viewed mark, saving the full viewed array and adopting the returned record.
  async function toggleViewed(path: string): Promise<void> {
    const set = new Set(viewed());
    if (set.has(path)) set.delete(path);
    else set.add(path);
    error = null;
    try {
      review.adopt(await deps.saveViewed([...set]));
    } catch (e) {
      error = errorMessage(e);
    }
  }

  // the record id, or null for a legacy file (which has no reply/resolve affordance).
  function recordId(): string | null {
    const r = review.record;
    return isRecord(r) ? r.id : null;
  }

  async function viaRecord(run: (id: string) => Promise<CommentsResponse>): Promise<string | null> {
    const id = recordId();
    if (id == null) {
      error = "not available on a legacy review";
      return error;
    }
    error = null;
    try {
      review.adopt(await run(id));
      return null;
    } catch (e) {
      error = errorMessage(e);
      return error;
    }
  }

  return {
    get comments(): Comment[] {
      return comments();
    },
    get anchored(): Comment[] {
      return partitionComments(comments(), getCurrentDiff() ?? EMPTY_DIFF).anchored;
    },
    get stale(): Comment[] {
      return partitionComments(comments(), getCurrentDiff() ?? EMPTY_DIFF).stale;
    },
    get error(): string | null {
      return error;
    },
    get viewedSet(): Set<string> {
      return new Set(viewed());
    },
    // unresolved comment count for a file, for the index badge.
    countFor(path: string): number {
      return comments().filter((c) => c.file === path && !isResolved(c)).length;
    },
    toggleViewed,
    add: (comment: Comment) => persist([...comments(), comment]),
    edit: (id: string, patch: Partial<Comment>) =>
      persist(comments().map((c) => (c.id === id ? { ...c, ...patch } : c))),
    remove: (id: string) => persist(comments().filter((c) => c.id !== id)),
    resolve: (commentId: string) => viaRecord((id) => deps.resolveReviewComment(id, commentId, "resolved")),
    reopen: (commentId: string) => viaRecord((id) => deps.resolveReviewComment(id, commentId, "open")),
    reply: (commentId: string, text: string) => viaRecord((id) => deps.replyToReviewComment(id, commentId, text)),
  };
}

export type CommentsStore = ReturnType<typeof createCommentsStore>;
