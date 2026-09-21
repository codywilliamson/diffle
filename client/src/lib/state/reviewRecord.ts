// pure helpers shared by the review + comments stores: shape guards over the durable
// ReviewRecord vs the legacy ReviewFile, unresolved counting, and the unread-activity fold.

import type { Comment, ReviewActivity, ReviewFile, ReviewRecord } from "$types";

// the current review is a durable record, a legacy file, or nothing yet.
export type ReviewData = ReviewRecord | ReviewFile;

// only durable records carry an id (+ status + activity); the legacy file has none.
export function isRecord(r: ReviewData | null): r is ReviewRecord {
  return r != null && "id" in r;
}

// the updatedAt lives on the record directly, on meta for the legacy file.
export function updatedAtOf(r: ReviewData): string {
  return "id" in r ? r.updatedAt : r.meta.updatedAt;
}

export function commentsOf(r: ReviewData | null): Comment[] {
  return r ? r.comments : [];
}

// resolved comments are kept for the record but drop out of open counts.
export const isResolved = (c: Comment): boolean => c.resolved === true || c.status === "resolved";

export function countUnresolved(comments: Comment[]): number {
  return comments.filter((c) => !isResolved(c)).length;
}

// running tally of agent activity the reviewer hasn't acknowledged since the last dismiss.
export interface ActivityNotice {
  replies: number; // new agent replies
  addressed: number; // comments the agent marked addressed
  rereview: boolean; // a rereview was requested or a comment reopened
  summary?: string; // newest rereview summary wins
}

export const emptyNotice = (): ActivityNotice => ({ replies: 0, addressed: 0, rereview: false });

export const noticeHasContent = (n: ActivityNotice): boolean =>
  n.replies > 0 || n.addressed > 0 || n.rereview;

// fold freshly-seen activity entries into the running notice, newest rereview summary winning.
export function foldActivity(notice: ActivityNotice, fresh: ReviewActivity[]): ActivityNotice {
  const next = { ...notice };
  for (const a of fresh) {
    if (a.type === "comment_replied" && a.actor === "agent") next.replies++;
    else if (a.type === "comment_addressed") next.addressed++;
    else if (a.type === "rereview_requested") {
      next.rereview = true;
      if (a.summary) next.summary = a.summary;
    } else if (a.type === "comment_reopened") next.rereview = true;
  }
  return next;
}

export const errorMessage = (e: unknown): string => (e instanceof Error ? e.message : String(e));
