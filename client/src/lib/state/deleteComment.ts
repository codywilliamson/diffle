// delete a comment and offer the Undo toast: shared by the dd key and the Delete button.

import type { Comment } from "$types";
import type { AppState } from "./context";

export const DELETED_NOTICE = "Comment deleted.";

// the whole comment (replies, status) goes back under its own id: the server keeps what the
// client sends for an id it no longer stores
export async function deleteCommentWithUndo({ ui, comments, lsp }: AppState, target: Comment): Promise<void> {
  const error = await comments.remove(target.id);
  if (error) return lsp.notify(error, "error");
  ui.offerUndo(DELETED_NOTICE, () => {
    void comments.add(target).then((failed) => failed && lsp.notify(failed, "error"));
  });
}
