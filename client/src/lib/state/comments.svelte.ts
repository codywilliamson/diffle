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
export const WRITE_TIMEOUT_MS = 15_000;
const TIMEOUT_MESSAGE = "The server did not answer in time.";
const RESYNC_FAILED_MESSAGE = "Could not confirm the latest comments with the server. Try again.";

export interface RemoveResult {
  error: string | null;
  removed: Comment | null; // the comment as the write that deleted it saw it
}

// a write that never settles must not stall the queue behind it
function withTimeout<T>(run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      controller.abort();
      reject(new Error(TIMEOUT_MESSAGE));
    }, WRITE_TIMEOUT_MS);
    run(controller.signal).then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

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

  // writes run one at a time, each building its payload from the record the previous one
  // adopted. two quick deletes or saves can't race, and a late response can't resurrect a comment.
  // a failed or timed-out write may still have landed, so the next task first re-reads the record
  // and builds on that. if the re-read fails too, the task is refused rather than guessed.
  let queueTail: Promise<unknown> = Promise.resolve();
  let stale = false;
  function inOrder<T>(task: () => Promise<T>, refused: (message: string) => T): Promise<T> {
    const run = queueTail.then(async () => {
      if (stale) {
        if (!(await review.resync())) return refused(RESYNC_FAILED_MESSAGE);
        stale = false;
      }
      return task();
    });
    queueTail = run.catch(() => undefined);
    return run;
  }

  // save the full comments array (built from the latest record) and adopt what the server returns.
  function persist(build: (current: Comment[]) => Comment[]): Promise<string | null> {
    return inOrder(() => persistNow(build), (message) => (error = message));
  }

  async function persistNow(build: (current: Comment[]) => Comment[]): Promise<string | null> {
    error = null;
    try {
      review.adopt(await withTimeout((signal) => deps.saveComments(build(comments()), signal)));
      return null;
    } catch (e) {
      stale = true;
      error = errorMessage(e);
      return error;
    }
  }

  // toggle a file's viewed mark, saving the full viewed array and adopting the returned record.
  function toggleViewed(path: string): Promise<void> {
    return inOrder(() => toggleViewedNow(path), (message) => void (error = message));
  }

  async function toggleViewedNow(path: string): Promise<void> {
    const set = new Set(viewed());
    if (set.has(path)) set.delete(path);
    else set.add(path);
    error = null;
    try {
      review.adopt(await withTimeout((signal) => deps.saveViewed([...set], signal)));
    } catch (e) {
      stale = true;
      error = errorMessage(e);
    }
  }

  // the record id, or null for a legacy file (which has no reply/resolve affordance).
  function recordId(): string | null {
    const r = review.record;
    return isRecord(r) ? r.id : null;
  }

  function viaRecord(run: (id: string) => Promise<CommentsResponse>): Promise<string | null> {
    return inOrder(() => viaRecordNow(run), (message) => (error = message));
  }

  async function viaRecordNow(run: (id: string) => Promise<CommentsResponse>): Promise<string | null> {
    const id = recordId();
    if (id == null) {
      error = "not available on a legacy review";
      return error;
    }
    error = null;
    try {
      review.adopt(await withTimeout(() => run(id)));
      return null;
    } catch (e) {
      stale = true;
      error = errorMessage(e);
      return error;
    }
  }

  // the comment is read inside the queued write, so it carries every earlier resolve or reply.
  // a second delete of the same id while one is pending shares its result.
  const pendingDeletes = new Map<string, Promise<RemoveResult>>();
  function removeComment(id: string): Promise<RemoveResult> {
    const pending = pendingDeletes.get(id);
    if (pending) return pending;
    const seen: { comment: Comment | null } = { comment: null };
    const run = persist((current) => {
      seen.comment = current.find((c) => c.id === id) ?? null;
      return current.filter((c) => c.id !== id);
    }).then((failure) => ({ error: failure, removed: failure ? null : seen.comment }));
    pendingDeletes.set(id, run);
    void run.finally(() => pendingDeletes.delete(id));
    return run;
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
    // skips an id that is already there, so a repeated undo can't duplicate a comment
    add: (comment: Comment) => persist((current) => (current.some((c) => c.id === comment.id) ? current : [...current, comment])),
    edit: (id: string, patch: Partial<Comment>) =>
      persist((current) => current.map((c) => (c.id === id ? { ...c, ...patch } : c))),
    remove: (id: string) => removeComment(id).then((result) => result.error),
    removeComment,
    resolve: (commentId: string) => viaRecord((id) => deps.resolveReviewComment(id, commentId, "resolved")),
    reopen: (commentId: string) => viaRecord((id) => deps.resolveReviewComment(id, commentId, "open")),
    reply: (commentId: string, text: string) => viaRecord((id) => deps.replyToReviewComment(id, commentId, text)),
  };
}

export type CommentsStore = ReturnType<typeof createCommentsStore>;
