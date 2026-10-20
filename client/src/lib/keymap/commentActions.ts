// keys that act on a comment already on the page: edit, delete, resolve, copy, step.
// they work on app.commentFocus.current, the comment anchored on the cursor line.

import type { AppState } from "$lib/state/context";
import { isResolved } from "$lib/state/reviewRecord";
import type { ActionHandler } from "./actions";
import type { ActionId } from "./types";

export const NO_COMMENT_NOTICE = "No comment on this line.";
const RESOLVED_EDIT_NOTICE = "Reopen the comment (R) to edit it.";
const COPIED_COMMENT_NOTICE = "Copied the comment.";
const COPIED_LINE_NOTICE = "Copied the line.";
const NOTHING_TO_COPY_NOTICE = "Nothing to copy here.";
const COPY_FAILED_NOTICE = "Could not copy to the clipboard.";

type CommentActionId = Extract<ActionId, `comment.${"edit" | "delete" | "resolve" | "copy" | "next" | "prev"}`>;

export function createCommentActions({ ui, comments, cursor, commentFocus, lsp }: AppState): Record<CommentActionId, ActionHandler> {
  async function copy(text: string, done: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      lsp.notify(done);
    } catch {
      lsp.notify(COPY_FAILED_NOTICE, "error");
    }
  }

  const step = (delta: number): void => {
    if (!commentFocus.step(delta)) lsp.notify(NO_COMMENT_NOTICE);
  };

  return {
    "comment.edit": () => {
      const target = commentFocus.current;
      if (!target) return lsp.notify(NO_COMMENT_NOTICE);
      if (isResolved(target)) return lsp.notify(RESOLVED_EDIT_NOTICE);
      ui.startEdit(target.id);
    },
    "comment.delete": () => {
      const target = commentFocus.current;
      if (!target) return lsp.notify(NO_COMMENT_NOTICE);
      void comments.remove(target.id);
    },
    "comment.resolve": () => {
      const target = commentFocus.current;
      if (!target) return lsp.notify(NO_COMMENT_NOTICE);
      void (isResolved(target) ? comments.reopen(target.id) : comments.resolve(target.id));
    },
    "comment.copy": () => {
      const target = commentFocus.current;
      if (target) return void copy(target.text, COPIED_COMMENT_NOTICE);
      const line = cursor.lineText();
      if (line === null) return lsp.notify(NOTHING_TO_COPY_NOTICE);
      void copy(line, COPIED_LINE_NOTICE);
    },
    "comment.next": () => step(1),
    "comment.prev": () => step(-1),
  };
}
