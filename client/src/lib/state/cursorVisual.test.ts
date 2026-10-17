import { describe, expect, it } from "vitest";
import type { DiffFile, DiffHunk, DiffLine } from "$types";
import { buildIndex } from "./cursorSteps";
import { resolveVisual } from "./cursorVisual";
import { createUiStore } from "./ui.svelte";
import { commitRange } from "$lib/diff/selectDrag";
import { createCursorStore } from "./cursor.svelte";

const ctx = (n: number): DiffLine => ({ type: "context", oldLine: n, newLine: n, content: `c${n}` });
const add = (n: number): DiffLine => ({ type: "addition", oldLine: null, newLine: n, content: `a${n}` });
const del = (n: number): DiffLine => ({ type: "deletion", oldLine: n, newLine: null, content: `d${n}` });
const hunk = (...lines: DiffLine[]): DiffHunk => ({ header: "@@", lines });
const file = (path: string, hunks: DiffHunk[]): DiffFile => ({ path, oldPath: null, changeType: "modified", additions: 0, deletions: 0, hunks });
const view = (f: DiffFile) => ({ file: f, split: false, navigable: true });

// a.ts: ctx1 del2 add2 ctx3 add4 ; b.ts: ctx1 ctx2
const A = file("a.ts", [hunk(ctx(1), del(2), add(2), ctx(3), add(4))]);
const B = file("b.ts", [hunk(ctx(1), ctx(2))]);
const index = buildIndex([view(A), view(B)], "new");

describe("mouse and keyboard ranges share one anchor", () => {
  it("selecting upward gives the same anchor as downward", () => {
    const down = createUiStore();
    const up = createUiStore();
    commitRange(down, "a.ts", "new", 1, 4);
    commitRange(up, "a.ts", "new", 4, 1);
    expect(up.adding).toEqual(down.adding);
    expect(down.adding).toEqual({ file: "a.ts", side: "new", line: 1, endLine: 4 });
  });

  it("a single line is the one-line range a click makes", () => {
    const ui = createUiStore();
    commitRange(ui, "a.ts", "new", 3, 3);
    expect(ui.adding).toEqual({ file: "a.ts", side: "new", line: 3, endLine: 3 });
  });
});

describe("resolveVisual", () => {
  const anchor = { path: "a.ts", side: "new" as const, line: 3 };

  it("follows the head on the same side, up or down", () => {
    expect(resolveVisual(index, anchor, { path: "a.ts", side: "new", line: 4 })?.to).toBe(4);
    expect(resolveVisual(index, anchor, { path: "a.ts", side: "new", line: 1 })?.to).toBe(1);
  });

  it("keeps the anchor side when the head crosses a deletion in unified", () => {
    const up = resolveVisual(index, anchor, { path: "a.ts", side: "old", line: 2 });
    expect(up).toEqual({ path: "a.ts", side: "new", from: 3, to: 2 }); // add2 is the nearest new-side stop
    const down = resolveVisual(index, { path: "a.ts", side: "new", line: 1 }, { path: "a.ts", side: "old", line: 2 });
    expect(down?.to).toBe(1); // nothing on the new side between ctx1 and del2
  });

  it("clamps a head in another file to this file's edge", () => {
    expect(resolveVisual(index, anchor, { path: "b.ts", side: "new", line: 2 })?.to).toBe(4);
    expect(resolveVisual(index, { path: "b.ts", side: "new", line: 1 }, { path: "a.ts", side: "new", line: 1 })?.to).toBe(1);
  });

  it("has no range for a file with no lines or an unknown file", () => {
    expect(resolveVisual(index, { path: "a.ts", side: "new", line: 0 }, null)).toBeNull();
    expect(resolveVisual(index, { path: "zzz.ts", side: "new", line: 1 }, null)).toBeNull();
  });
});

describe("cursor visual mode", () => {
  function store() {
    let active: string | null = null;
    return createCursorStore({ files: () => [A, B], defaultSplit: () => false, activePath: () => active, follow: (p) => (active = p) });
  }

  it("extends with motions and ends cleanly", () => {
    const cursor = store();
    cursor.lines("a.ts", 1);
    cursor.startVisual("a.ts");
    expect(cursor.visual).toBe(true);
    cursor.lines("a.ts", 4); // ctx1 -> del2 -> add2 -> ctx3 -> add4
    expect(cursor.visualRange).toEqual({ path: "a.ts", side: "new", from: 1, to: 4 });
    cursor.endVisual();
    expect(cursor.visual).toBe(false);
    expect(cursor.visualRange).toBeNull();
    expect(cursor.pos).toMatchObject({ path: "a.ts", line: 4 });
  });

  it("ignores h and l while a range is open", () => {
    const cursor = store();
    cursor.lines("a.ts", 1);
    cursor.startVisual("a.ts");
    cursor.switchTo("a.ts", "old");
    expect(cursor.side).toBe("new");
  });

  it("starting a range with nothing selected lands on the first line", () => {
    const cursor = store();
    cursor.startVisual("a.ts");
    expect(cursor.visualRange).toEqual({ path: "a.ts", side: "new", from: 1, to: 1 });
  });
});
