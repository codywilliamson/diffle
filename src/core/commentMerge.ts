// merges a reviewer's saved comments array into the stored Review Record. the incoming
// array (from the client) decides which reviewer comments exist and their reviewer-owned fields;
// agent-owned fields (replies/status/resolved) come from the stored copy when it has them,
// so a stale client save can't clobber a reply or an addressed mark the agent just wrote.
// agent-authored comments are wholly agent-owned: the stored copy wins and a save that lacks
// one (stale, or a delete) keeps it — the reviewer replies or resolves instead.
import type { Comment } from "../types";

const isAgent = (comment: Comment) => comment.author === "agent";

export function mergeReviewerComments(stored: Comment[], incoming: Comment[]): Comment[] {
  const storedById = new Map(stored.map((comment) => [comment.id, comment]));
  const merged = incoming.map(({ author: _claimed, ...comment }): Comment => { // the browser only writes as the reviewer
    const previous = storedById.get(comment.id);
    if (!previous) return comment;
    if (isAgent(previous)) return previous;
    return {
      ...comment,
      replies: previous.replies ?? comment.replies,
      status: previous.status ?? comment.status,
      resolved: previous.resolved ?? comment.resolved,
    };
  });
  const kept = new Set(merged.map((comment) => comment.id));
  return [...merged, ...stored.filter((comment) => isAgent(comment) && !kept.has(comment.id))];
}
