// which comments the keyboard cursor is "on": the ones whose anchor covers the cursor line.
// pure so the keymap actions and the card highlight agree.

import type { Comment } from "$types";
import { FILE_LEVEL, type CursorPos } from "./cursorSteps";

const sideOf = (c: Comment): "old" | "new" => c.side ?? "new";

export function commentsAtCursor(comments: Comment[], pos: CursorPos | null): Comment[] {
  if (!pos) return [];
  if (pos.line === FILE_LEVEL) return comments.filter((c) => c.file === pos.path && c.line === null);
  return comments.filter((c) => {
    if (c.file !== pos.path || c.line === null || sideOf(c) !== pos.side) return false;
    return pos.line >= c.line && pos.line <= (c.endLine ?? c.line);
  });
}
