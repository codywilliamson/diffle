// the comment the comment keys act on: the first one anchored on the cursor line, or the one
// stepped to with { and } when several share it. the choice belongs to the line it was made on.

import type { Comment } from "$types";
import type { CursorPos } from "./cursorSteps";
import { commentsAtCursor } from "./commentsAtCursor";

export interface CommentFocusDeps {
  comments: () => Comment[];
  pos: () => CursorPos | null;
}

const keyOf = (pos: CursorPos | null): string => (pos ? `${pos.path}|${pos.side}|${pos.line}` : "");

export function createCommentFocus({ comments, pos }: CommentFocusDeps) {
  let stepped = $state<{ key: string; index: number } | null>(null);

  const here = (): Comment[] => commentsAtCursor(comments(), pos());
  const indexIn = (count: number): number => {
    const index = stepped && stepped.key === keyOf(pos()) ? stepped.index : 0;
    return count === 0 ? 0 : Math.min(index, count - 1);
  };

  return {
    get all(): Comment[] {
      return here();
    },
    get current(): Comment | null {
      const list = here();
      return list[indexIn(list.length)] ?? null;
    },
    // wraps; false when nothing is anchored here
    step(delta: number): boolean {
      const list = here();
      if (list.length === 0) return false;
      const next = (indexIn(list.length) + delta + list.length) % list.length;
      stepped = { key: keyOf(pos()), index: next };
      return true;
    },
  };
}

export type CommentFocus = ReturnType<typeof createCommentFocus>;
