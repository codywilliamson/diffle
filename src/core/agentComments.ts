// comments the agent opens itself, e.g. open points from its own self-review. they are
// agent-authored, so they only reach the agent's inbox once the reviewer replies.

import { randomUUID } from "node:crypto";
import type { Comment, CommentTag, ReviewRecord } from "../types";
import { updateReviewRecord } from "./reviewRecords";

export interface AgentCommentInput {
  file: string;
  side?: "old" | "new";
  line?: number; // absent = file-level
  endLine?: number;
  text: string;
  tag?: CommentTag;
}

export function addAgentComment(reviewId: string, input: AgentCommentInput): ReviewRecord {
  if (input.line === undefined && (input.side !== undefined || input.endLine !== undefined)) throw new Error("side and endLine need a line");
  if (input.line !== undefined && input.endLine !== undefined && input.endLine < input.line) throw new Error("endLine must not be before line");
  const comment: Comment = {
    id: randomUUID(), author: "agent", file: input.file, line: input.line ?? null, lineContent: null,
    text: input.text, status: "open", createdAt: new Date().toISOString(),
    ...(input.side ? { side: input.side } : {}), ...(input.endLine !== undefined ? { endLine: input.endLine } : {}),
    ...(input.tag ? { tag: input.tag } : {}),
  };
  return updateReviewRecord(reviewId, (record) => ({ comments: [...record.comments, comment] }));
}
