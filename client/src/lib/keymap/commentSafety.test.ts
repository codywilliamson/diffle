import { describe, expect, it, vi } from "vitest";
import type { Comment } from "$types";
import type { AppState } from "$lib/state/context";
import { createCommentFocus } from "$lib/state/commentFocus.svelte";
import { visibleCursor } from "$lib/state/commentsAtCursor";
import type { CursorPos } from "$lib/state/cursorSteps";
import { createUiStore, UNDO_MS } from "$lib/state/ui.svelte";
import { createCommentActions } from "./commentActions";
import { EMPTY_STATE, step } from "./parser";
import { repeatAllowed } from "./repeat";
import type { Outcome } from "./types";

const c = (id: string, over: Partial<Comment> = {}): Comment => ({
  id, file: "a.ts", line: 5, lineContent: "x", text: id, createdAt: "2026-01-01T00:00:00Z", ...over,
});
const at = (line: number, path = "a.ts"): CursorPos => ({ path, side: "new", line });

function outcomeOf(keys: string[]): Outcome {
  let state = EMPTY_STATE;
  let last!: Outcome;
  keys.forEach((k, i) => {
    const r = step(state, { key: k, ctrl: false, shift: false, alt: false, altGraph: false, meta: false, editable: false }, "normal", i * 10);
    state = r.state;
    last = r.outcome;
  });
  return last;
}

function harness(list: Comment[], pos: CursorPos | null) {
  const ui = createUiStore();
  const comments = { removeComment: vi.fn(async (id: string) => ({ error: null as string | null, removed: list.find((x) => x.id === id) ?? null })), add: vi.fn().mockResolvedValue(null) };
  const lsp = { notify: vi.fn() };
  const commentFocus = createCommentFocus({ comments: () => list, pos: () => pos });
  const actions = createCommentActions({ ui, comments, drafts: { clearMany: vi.fn() }, cursor: {}, commentFocus, lsp } as unknown as AppState);
  return { ui, comments, lsp, actions };
}

describe("held keys", () => {
  it("a repeated d cannot finish dd or yy, and motions still repeat", () => {
    expect(repeatAllowed(outcomeOf(["d"]))).toBe(false);
    expect(repeatAllowed(outcomeOf(["d", "d"]))).toBe(false);
    expect(repeatAllowed(outcomeOf(["y", "y"]))).toBe(false);
    expect(repeatAllowed(outcomeOf(["R"]))).toBe(false);
    expect(repeatAllowed(outcomeOf(["j"]))).toBe(true);
    expect(repeatAllowed(outcomeOf(["J"]))).toBe(true);
    expect(repeatAllowed(outcomeOf(["]"]))).toBe(true);
  });

  it("keys the keymap ignores are left alone", () => {
    expect(repeatAllowed(outcomeOf(["0"]))).toBe(true);
  });
});

describe("delete and undo", () => {
  it("dd offers an undo that puts the whole comment back under its id", async () => {
    const original = c("one", { text: "keep me", replies: [{ id: "r1", author: "agent", text: "done", createdAt: "x" }], status: "addressed" });
    const h = harness([original], at(5));
    h.actions["comment.delete"](null);
    await vi.waitFor(() => expect(h.ui.undo).not.toBeNull());
    expect(h.comments.removeComment).toHaveBeenCalledWith("one");
    h.actions["comment.undo"](null);
    expect(h.comments.add).toHaveBeenCalledWith(original);
    expect(h.ui.undo).toBeNull();
  });

  it("the offer expires after UNDO_MS", async () => {
    vi.useFakeTimers();
    try {
      const h = harness([c("one")], at(5));
      h.actions["comment.delete"](null);
      await vi.advanceTimersByTimeAsync(UNDO_MS - 1);
      expect(h.ui.undo).not.toBeNull();
      await vi.advanceTimersByTimeAsync(2);
      expect(h.ui.undo).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("a failed delete offers nothing, and u with nothing to undo says so", async () => {
    const h = harness([c("one")], at(5));
    h.comments.removeComment.mockResolvedValue({ error: "offline", removed: null });
    h.actions["comment.delete"](null);
    await vi.waitFor(() => expect(h.lsp.notify).toHaveBeenCalledWith("offline", "error"));
    expect(h.ui.undo).toBeNull();
    h.actions["comment.undo"](null);
    expect(h.lsp.notify).toHaveBeenCalledWith("Nothing to undo.");
  });
});

describe("focus follows the file on screen", () => {
  it("the cursor does not count once another file is active", () => {
    expect(visibleCursor(at(5), "a.ts")).toEqual(at(5));
    expect(visibleCursor(at(5), null)).toEqual(at(5));
    expect(visibleCursor(at(5), "b.ts")).toBeNull();
    expect(visibleCursor(null, "a.ts")).toBeNull();
  });

  it("so dd in another file finds no comment to delete", () => {
    let active: string | null = "a.ts";
    const list = [c("one")];
    const focus = createCommentFocus({ comments: () => list, pos: () => visibleCursor(at(5), active) });
    expect(focus.current?.id).toBe("one");
    active = "b.ts";
    expect(focus.current).toBeNull();
  });
});

describe("editing state", () => {
  it("a save finishing for one comment does not close another's editor", () => {
    const ui = createUiStore();
    ui.startEdit("a");
    ui.startEdit("b");
    ui.stopEdit("a");
    expect(ui.editingComment).toBe("b");
    ui.stopEdit("b");
    expect(ui.editingComment).toBeNull();
  });

  it("e on a file-level comment asks its file to open first", () => {
    const h = harness([c("file", { line: null })], at(0));
    const open = vi.spyOn(h.ui, "requestOpen");
    h.actions["comment.edit"](null);
    expect(open).toHaveBeenCalledWith("a.ts");
    expect(h.ui.editingComment).toBe("file");
  });
});
