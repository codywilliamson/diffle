import { describe, expect, it } from "vitest";
import type { DiffFile, DiffHunk, DiffLine } from "$types";
import { createCursorStore } from "$lib/state/cursor.svelte";
import { createUiStore } from "$lib/state/ui.svelte";

const ctx = (n: number, text = `c${n}`): DiffLine => ({ type: "context", oldLine: n, newLine: n, content: text });
const hunk = (...lines: DiffLine[]): DiffHunk => ({ header: "@@", lines });
const file = (path: string, hunks: DiffHunk[]): DiffFile => ({ path, oldPath: null, changeType: "modified", additions: 0, deletions: 0, hunks });

function cursorOver(initial: DiffFile[]) {
  let files = initial;
  let active: string | null = null;
  const cursor = createCursorStore({ files: () => files, defaultSplit: () => false, activePath: () => active, follow: (p) => (active = p) });
  return { cursor, setFiles: (next: DiffFile[]) => (files = next) };
}

// a range from line 1 to 3 in a.ts, then left
function leftRange(files: DiffFile[]) {
  const h = cursorOver(files);
  h.cursor.lines("a.ts", 1);
  h.cursor.startVisual("a.ts");
  h.cursor.lines("a.ts", 2);
  h.cursor.endVisual();
  return h;
}

describe("gv after the diff changed", () => {
  const same = () => file("a.ts", [hunk(ctx(1), ctx(2), ctx(3), ctx(4))]);

  it("restores the range when both ends are still the same lines", () => {
    const h = leftRange([same()]);
    h.setFiles([same()]); // a refresh that changed nothing
    expect(h.cursor.reselectVisual()).toBe(true);
  });

  it("does nothing when the end line now holds different text", () => {
    const h = leftRange([same()]);
    h.setFiles([file("a.ts", [hunk(ctx(1), ctx(2), ctx(3, "rewritten"), ctx(4))])]);
    expect(h.cursor.reselectVisual()).toBe(false);
    expect(h.cursor.visual).toBe(false);
  });

  it("does nothing when the start line changed, or the file left the diff", () => {
    const start = leftRange([same()]);
    start.setFiles([file("a.ts", [hunk(ctx(1, "rewritten"), ctx(2), ctx(3), ctx(4))])]);
    expect(start.cursor.reselectVisual()).toBe(false);
    const gone = leftRange([same()]);
    gone.setFiles([file("b.ts", [hunk(ctx(1), ctx(2))])]);
    expect(gone.cursor.reselectVisual()).toBe(false);
  });

  it("does nothing when the lines moved to other numbers", () => {
    const h = leftRange([same()]);
    h.setFiles([file("a.ts", [hunk(ctx(5, "c1"), ctx(6, "c2"), ctx(7, "c3"), ctx(8, "c4"))])]);
    expect(h.cursor.reselectVisual()).toBe(false);
  });
});

describe("folds that outlive a mounted file", () => {
  it("a file that mounts after zC starts collapsed, and after zO starts expanded", () => {
    const ui = createUiStore();
    expect(ui.foldFor("a.ts")).toBeNull();
    ui.requestFold(null, true);
    expect(ui.foldFor("a.ts")).toBe(true);
    ui.requestFold(null, false);
    expect(ui.foldFor("a.ts")).toBe(false);
  });

  it("a per-file choice beats the last global one, until the next global one", () => {
    const ui = createUiStore();
    ui.requestFold(null, true);
    ui.requestFold("a.ts", false);
    expect(ui.foldFor("a.ts")).toBe(false);
    expect(ui.foldFor("b.ts")).toBe(true);
    ui.noteFold("b.ts", false); // the chevron
    expect(ui.foldFor("b.ts")).toBe(false);
    ui.requestFold(null, true);
    expect(ui.foldFor("a.ts")).toBe(true);
    expect(ui.foldFor("b.ts")).toBe(true);
  });
});
