import { describe, expect, it, vi } from "vitest";
import type { Comment } from "$types";
import { deleteCommentWithUndo } from "./deleteComment";
import { commentDraftKeys } from "./draftKeys";
import { createDraftsStore } from "./drafts.svelte";
import type { AppState } from "./context";

const comment = { id: "c1" } as Comment;

function setup(removeResult: { error?: string; removed?: Comment }) {
  const save = vi.fn().mockResolvedValue({ drafts: {} });
  const drafts = createDraftsStore({ load: async () => ({}), save });
  for (const key of commentDraftKeys(comment.id)) drafts.set(key, "unsent");
  drafts.set("edit|other", "keep me");
  const state = {
    ui: { offerUndo: vi.fn() },
    comments: { removeComment: vi.fn().mockResolvedValue(removeResult), add: vi.fn() },
    lsp: { notify: vi.fn() },
    drafts,
  } as unknown as AppState;
  return { state, drafts, save };
}

describe("deleteCommentWithUndo drafts", () => {
  it("clears the comment's edit and reply drafts, leaving others", async () => {
    const { state, drafts, save } = setup({ removed: comment });
    await deleteCommentWithUndo(state, comment);
    for (const key of commentDraftKeys(comment.id)) expect(drafts.get(key)).toBeUndefined();
    expect(drafts.get("edit|other")).toBe("keep me");
    const sent = save.mock.calls.flatMap((c) => c[0]).filter((u: { text: string }) => u.text === "");
    expect(sent.map((u: { key: string }) => u.key).sort()).toEqual(commentDraftKeys(comment.id).sort());
  });

  it("keeps drafts when the delete fails", async () => {
    const { state, drafts } = setup({ error: "nope" });
    await deleteCommentWithUndo(state, comment);
    for (const key of commentDraftKeys(comment.id)) expect(drafts.get(key)).toBe("unsent");
  });
});
