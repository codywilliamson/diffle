import { describe, expect, it } from "vitest";
import type { DiffFile, DiffHunk, DiffLine } from "$types";
import { createCursorStore } from "./cursor.svelte";

const ctx = (n: number): DiffLine => ({ type: "context", oldLine: n, newLine: n, content: `c${n}` });
const add = (n: number): DiffLine => ({ type: "addition", oldLine: null, newLine: n, content: `a${n}` });
const del = (n: number): DiffLine => ({ type: "deletion", oldLine: n, newLine: null, content: `d${n}` });
const hunk = (...lines: DiffLine[]): DiffHunk => ({ header: "@@", lines });
const file = (path: string, hunks: DiffHunk[]): DiffFile => ({ path, oldPath: null, changeType: "modified", additions: 0, deletions: 0, hunks });

function store(files: () => DiffFile[], split: boolean) {
  let active: string | null = null;
  const cursor = createCursorStore({
    files,
    defaultSplit: () => split,
    activePath: () => active,
    follow: (p) => (active = p),
  });
  return cursor;
}

describe("jump history across sides", () => {
  // a.ts: ctx1 del2 add2 ctx3 | gap | ctx10 add11, split view
  const A = file("a.ts", [hunk(ctx(1), del(2), add(2), ctx(3)), hunk(ctx(10), add(11))]);

  it("restores the recorded old pane after l and Ctrl+o", () => {
    const cursor = store(() => [A], true);
    cursor.lines("a.ts", 1);
    cursor.switchTo("a.ts", "old");
    cursor.lines("a.ts", 1); // old pane: line 2
    cursor.bottom("a.ts"); // a jump away from old line 2
    expect(cursor.pos).toMatchObject({ side: "old", line: 10 });
    cursor.switchTo("a.ts", "new");
    expect(cursor.side).toBe("new");
    cursor.back("a.ts");
    expect(cursor.side).toBe("old");
    expect(cursor.pos).toEqual({ path: "a.ts", side: "old", line: 2 });
  });
});

describe("refresh", () => {
  it("asks the pane to scroll when the cursor is relocated, not when it stays", () => {
    let files = [file("a.ts", [hunk(ctx(1), ctx(2), ctx(3))])];
    const cursor = store(() => files, false);
    cursor.lines("a.ts", 3);
    const seq = cursor.revealSeq;
    files = [file("a.ts", [hunk(ctx(1), ctx(2), ctx(3))])];
    cursor.reconcile();
    expect(cursor.revealSeq).toBe(seq);
    files = [file("a.ts", [hunk(ctx(5), ctx(6), ctx(7), { ...ctx(3), newLine: 8, oldLine: 8 })])];
    cursor.reconcile();
    expect(cursor.pos).toMatchObject({ line: 8 });
    expect(cursor.revealSeq).toBeGreaterThan(seq);
  });
});
