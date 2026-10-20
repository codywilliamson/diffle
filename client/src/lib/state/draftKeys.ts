// the key an unsent comment is stored under: one per anchor, so reopening the same box finds it.
// add boxes key on their anchor (file, side, line range, or file-level); edit and reply boxes on the comment id.

import type { AddTarget } from "$lib/diff/threads";

export function addDraftKey(target: AddTarget): string {
  if (target.line === null) return `add|${target.file}|file`;
  return `add|${target.file}|${target.side ?? "new"}|${target.line}-${target.endLine ?? target.line}`;
}

export const editDraftKey = (commentId: string): string => `edit|${commentId}`;
export const replyDraftKey = (commentId: string): string => `reply|${commentId}`;

// every key that belongs to one comment, for dropping them when the comment goes away
export function commentDraftKeys(commentId: string): string[] {
  return [editDraftKey(commentId), replyDraftKey(commentId)];
}
