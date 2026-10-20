import { describe, expect, it, vi } from "vitest";
import type { Comment } from "$types";
import type { AppState } from "$lib/state/context";
import { createCommentFocus } from "$lib/state/commentFocus.svelte";
import { createUiStore } from "$lib/state/ui.svelte";
import { commentsAtCursor } from "$lib/state/commentsAtCursor";
import type { CursorPos } from "$lib/state/cursorSteps";
import { createCommentActions, NO_COMMENT_NOTICE } from "./commentActions";
import { EMPTY_STATE, step } from "./parser";
import type { KeyInput, Mode, Outcome, ParserState } from "./types";

const key = (k: string, extra: Partial<KeyInput> = {}): KeyInput => ({
  key: k, ctrl: false, shift: false, alt: false, altGraph: false, meta: false, editable: false, ...extra,
});

function press(keys: string[], mode: Mode = "normal", editable = false): Outcome[] {
  let state: ParserState = EMPTY_STATE;
  return keys.map((k, i) => {
    const result = step(state, key(k, { editable }), mode, i * 10);
    state = result.state;
    return result.outcome;
  });
}

const action = (o: Outcome | undefined): string | null => (o?.kind === "dispatch" ? o.binding.action : null);

describe("comment key dispatch", () => {
  it("binds e, R, dd, yy and the stepping keys", () => {
    expect(action(press(["e"])[0])).toBe("comment.edit");
    expect(action(press(["R"])[0])).toBe("comment.resolve");
    expect(action(press(["d", "d"])[1])).toBe("comment.delete");
    expect(action(press(["y", "y"])[1])).toBe("comment.copy");
    expect(action(press(["}"])[0])).toBe("comment.next");
    expect(action(press(["{"])[0])).toBe("comment.prev");
  });

  it("a lone d or y waits for its pair and a mismatched pair is dropped", () => {
    expect(press(["d"])[0]!.kind).toBe("pending");
    expect(press(["d", "y"])[1]!.kind).toBe("dropped");
    expect(press(["y", "d"])[1]!.kind).toBe("dropped");
  });

  it("does not fire in visual mode", () => {
    expect(press(["e"], "visual")[0]!.kind).toBe("ignored");
    expect(press(["d"], "visual")[0]!.kind).toBe("ignored");
    expect(press(["R"], "visual")[0]!.kind).toBe("ignored");
  });

  it("does not fire inside a text field", () => {
    for (const k of ["e", "d", "y", "R"]) expect(press([k], "normal", true)[0]!.kind).toBe("ignored");
  });

  it("leaves c, V and C alone", () => {
    expect(action(press(["c"])[0])).toBe("comment.line");
    expect(action(press(["V"])[0])).toBe("visual.start");
    expect(action(press(["c"], "visual")[0])).toBe("comment.range");
    expect(action(press(["C"])[0])).toBe("comment.file");
  });

  it("takes no count: 3e still runs edit once", () => {
    const outcomes = press(["3", "e"]);
    expect(outcomes[1]).toMatchObject({ kind: "dispatch", count: null });
  });
});

const c = (id: string, over: Partial<Comment>): Comment => ({
  id, file: "a.ts", line: 5, lineContent: "x", text: id, createdAt: "2026-01-01T00:00:00Z", ...over,
});
const at = (line: number, side: "old" | "new" = "new", path = "a.ts"): CursorPos => ({ path, side, line });

describe("commentsAtCursor", () => {
  const list = [
    c("single", { line: 5 }),
    c("range", { line: 4, endLine: 7 }),
    c("old", { line: 5, side: "old" }),
    c("other", { file: "b.ts", line: 5 }),
    c("file", { line: null }),
  ];

  it("returns the comments whose anchor covers the cursor line on the same side", () => {
    expect(commentsAtCursor(list, at(5)).map((x) => x.id)).toEqual(["single", "range"]);
    expect(commentsAtCursor(list, at(6)).map((x) => x.id)).toEqual(["range"]);
    expect(commentsAtCursor(list, at(5, "old")).map((x) => x.id)).toEqual(["old"]);
  });

  it("returns file-level comments on the file header and nothing without a cursor", () => {
    expect(commentsAtCursor(list, at(0)).map((x) => x.id)).toEqual(["file"]);
    expect(commentsAtCursor(list, null)).toEqual([]);
    expect(commentsAtCursor(list, at(99))).toEqual([]);
  });
});

describe("commentFocus", () => {
  it("steps through the comments on a line, wraps, and resets when the cursor moves", () => {
    const list = [c("one", { line: 5 }), c("two", { line: 5 })];
    let pos = at(5);
    const focus = createCommentFocus({ comments: () => list, pos: () => pos });
    expect(focus.current?.id).toBe("one");
    expect(focus.step(1)).toBe(true);
    expect(focus.current?.id).toBe("two");
    focus.step(1);
    expect(focus.current?.id).toBe("one");
    focus.step(-1);
    expect(focus.current?.id).toBe("two");
    pos = at(6);
    expect(focus.current).toBeNull();
    expect(focus.step(1)).toBe(false);
  });
});

function harness(list: Comment[], pos: CursorPos | null, lineText: string | null = "const x = 1;") {
  const ui = createUiStore();
  const comments = { remove: vi.fn(), resolve: vi.fn(), reopen: vi.fn() };
  const lsp = { notify: vi.fn() };
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  const commentFocus = createCommentFocus({ comments: () => list, pos: () => pos });
  const actions = createCommentActions({ ui, comments, cursor: { lineText: () => lineText }, commentFocus, lsp } as unknown as AppState);
  return { ui, comments, lsp, writeText, actions };
}

describe("comment actions", () => {
  it("edit opens the editor on the focused comment", () => {
    const h = harness([c("one", {})], at(5));
    h.actions["comment.edit"](null);
    expect(h.ui.editingComment).toBe("one");
  });

  it("edit on a resolved comment says to reopen it", () => {
    const h = harness([c("one", { resolved: true })], at(5));
    h.actions["comment.edit"](null);
    expect(h.ui.editingComment).toBeNull();
    expect(h.lsp.notify).toHaveBeenCalledWith(expect.stringContaining("Reopen"));
  });

  it("delete removes the focused comment", () => {
    const h = harness([c("one", {})], at(5));
    h.actions["comment.delete"](null);
    expect(h.comments.remove).toHaveBeenCalledWith("one");
  });

  it("resolve toggles by the comment's state", () => {
    const open = harness([c("one", {})], at(5));
    open.actions["comment.resolve"](null);
    expect(open.comments.resolve).toHaveBeenCalledWith("one");
    const done = harness([c("two", { status: "resolved" })], at(5));
    done.actions["comment.resolve"](null);
    expect(done.comments.reopen).toHaveBeenCalledWith("two");
  });

  it("copy sends the comment text, else the cursor line", async () => {
    const withComment = harness([c("one", { text: "fix this" })], at(5));
    withComment.actions["comment.copy"](null);
    expect(withComment.writeText).toHaveBeenCalledWith("fix this");
    const bare = harness([], at(5));
    bare.actions["comment.copy"](null);
    expect(bare.writeText).toHaveBeenCalledWith("const x = 1;");
  });

  it("copy on a file header with no comment copies nothing", () => {
    const h = harness([], at(0), null);
    h.actions["comment.copy"](null);
    expect(h.writeText).not.toHaveBeenCalled();
    expect(h.lsp.notify).toHaveBeenCalled();
  });

  it("every comment key says so when no comment is on the line", () => {
    for (const id of ["comment.edit", "comment.delete", "comment.resolve", "comment.next"] as const) {
      const h = harness([], at(5));
      h.actions[id](null);
      expect(h.lsp.notify).toHaveBeenCalledWith(NO_COMMENT_NOTICE);
      expect(h.comments.remove).not.toHaveBeenCalled();
    }
  });
});
