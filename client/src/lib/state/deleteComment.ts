// delete a comment and offer the Undo toast: shared by the dd key and the Delete button.

import type { Comment } from "$types";
import type { AppState } from "./context";
import { commentDraftKeys } from "./draftKeys";

export const DELETED_NOTICE = "Comment deleted.";

// the comment is the one the delete itself removed (replies, status and all), restored under its
// own id: the server keeps what the client sends for an id it no longer stores
export async function deleteCommentWithUndo({ ui, comments, drafts, lsp }: AppState, target: Comment): Promise<void> {
  const { error, removed } = await comments.removeComment(target.id);
  if (error) return lsp.notify(error, "error");
  if (!removed) return;
  drafts.clearMany(commentDraftKeys(target.id));
  ui.offerUndo(DELETED_NOTICE, () => {
    void comments.add(removed).then((failed) => failed && lsp.notify(failed, "error"));
  });
}
