import { describe, expect, it } from "vitest";
import type { DiffFile, DiffLine, DiffHunk } from "$types";
import {
  FILE_LEVEL, contentAt, cursorOnLine, firstLine, goToLineNumber, lastLine, moveFiles, moveHunks, moveLines,
  reanchor, switchSide, type CursorPos, type FileView,
} from "./cursorSteps";

const ctx = (n: number, text = `c${n}`): DiffLine => ({ type: "context", oldLine: n, newLine: n, content: text });
const add = (n: number, text = `a${n}`): DiffLine => ({ type: "addition", oldLine: null, newLine: n, content: text });
const del = (n: number, text = `d${n}`): DiffLine => ({ type: "deletion", oldLine: n, newLine: null, content: text });
const hunk = (...lines: DiffLine[]): DiffHunk => ({ header: "@@", lines });
const file = (path: string, hunks: DiffHunk[], extra: Partial<DiffFile> = {}): DiffFile => ({
  path, oldPath: null, changeType: "modified", additions: 0, deletions: 0, hunks, ...extra,
});
const view = (f: DiffFile, extra: Partial<FileView> = {}): FileView => ({ file: f, split: false, navigable: true, ...extra });

// a.ts: hunk 0 = ctx1 del2 add2 ctx3, hunk 1 = ctx10 add11
const A = file("a.ts", [hunk(ctx(1), del(2), add(2), ctx(3)), hunk(ctx(10), add(11))]);
// b.ts: one hunk of three additions
const B = file("b.ts", [hunk(add(1), add(2), add(3))]);
// c.ts: gated large file, no stops
const C = file("c.ts", [hunk(add(1))]);
const D = file("d.ts", [hunk(ctx(5), add(6))]);

const at = (path: string, side: "old" | "new", line: number): CursorPos => ({ path, side, line });
const parked = (path: string): CursorPos => at(path, "new", FILE_LEVEL);
const plain = [view(A), view(B), view(C, { navigable: false }), view(D)];

describe("line motion", () => {
  it("steps one line, including deletions in unified view", () => {
    expect(moveLines(plain, "new", at("a.ts", "new", 1), 1)).toEqual(at("a.ts", "old", 2));
    expect(moveLines(plain, "new", at("a.ts", "old", 2), 1)).toEqual(at("a.ts", "new", 2));
  });

  it("applies counts and crosses file boundaries", () => {
    expect(moveLines(plain, "new", at("a.ts", "new", 1), 4)).toEqual(at("a.ts", "new", 10));
    expect(moveLines(plain, "new", at("a.ts", "new", 11), 1)).toEqual(at("b.ts", "new", 1));
    expect(moveLines(plain, "new", at("a.ts", "new", 1), 7)).toEqual(at("b.ts", "new", 2));
  });

  it("clamps at both ends of the diff", () => {
    expect(moveLines(plain, "new", at("a.ts", "new", 1), -3)).toEqual(at("a.ts", "new", 1));
    expect(moveLines(plain, "new", at("d.ts", "new", 6), 50)).toEqual(at("d.ts", "new", 6));
  });

  it("walks backward over a gated file as if it were not there", () => {
    expect(moveLines(plain, "new", at("d.ts", "new", 5), -1)).toEqual(at("b.ts", "new", 3));
  });

  it("enters the first line from a parked cursor and counts from there", () => {
    expect(moveLines(plain, "new", parked("a.ts"), 1)).toEqual(at("a.ts", "new", 1));
    expect(moveLines(plain, "new", parked("a.ts"), 7)).toEqual(at("b.ts", "new", 1));
    expect(moveLines(plain, "new", parked("b.ts"), -1)).toEqual(at("a.ts", "new", 11));
  });

  it("leaves a parked gated file for the next real line", () => {
    expect(moveLines(plain, "new", parked("c.ts"), 1)).toEqual(at("d.ts", "new", 5));
    expect(moveLines(plain, "new", parked("c.ts"), -1)).toEqual(at("b.ts", "new", 3));
  });

  it("has nowhere to go in an empty diff", () => {
    expect(moveLines([], "new", parked("a.ts"), 1)).toBeNull();
    expect(moveLines([view(file("e.ts", []))], "new", parked("e.ts"), 1)).toBeNull();
    expect(moveLines([view(A, { navigable: false })], "new", parked("a.ts"), 1)).toBeNull();
  });

  it("falls back to the nearest line when the cursor line is gone", () => {
    expect(moveLines(plain, "new", at("a.ts", "new", 7), 1)).toEqual(at("a.ts", "new", 11));
  });
});

describe("split view", () => {
  const split = [view(A, { split: true }), view(B)];

  it("only visits the cursor side", () => {
    expect(moveLines(split, "new", at("a.ts", "new", 1), 1)).toEqual(at("a.ts", "new", 2));
    expect(moveLines(split, "old", at("a.ts", "old", 1), 1)).toEqual(at("a.ts", "old", 2));
    expect(moveLines(split, "old", at("a.ts", "old", 2), 1)).toEqual(at("a.ts", "old", 3));
  });

  it("switches sides within the same row, or the nearest row that has the other side", () => {
    expect(switchSide(split, at("a.ts", "new", 2), "old")).toEqual(at("a.ts", "old", 2));
    expect(switchSide(split, at("a.ts", "new", 3), "old")).toEqual(at("a.ts", "old", 3));
    expect(switchSide(split, at("a.ts", "new", 11), "old")).toEqual(at("a.ts", "old", 10));
    expect(switchSide(split, at("a.ts", "old", 2), "new")).toEqual(at("a.ts", "new", 2));
  });

  it("does nothing in a unified file, on the same side, or when parked", () => {
    expect(switchSide(split, at("b.ts", "new", 1), "old")).toBeNull();
    expect(switchSide(split, at("a.ts", "new", 2), "new")).toBeNull();
    expect(switchSide(split, parked("a.ts"), "old")).toBeNull();
  });

  it("finds the cursor row on whichever pane is marked", () => {
    expect(cursorOnLine(at("a.ts", "old", 2), del(2), "old")).toBe(true);
    expect(cursorOnLine(at("a.ts", "old", 2), add(2), "new")).toBe(false);
    expect(cursorOnLine(at("a.ts", "new", 2), add(2), "new")).toBe(true);
    expect(cursorOnLine(at("a.ts", "new", 3), ctx(3))).toBe(true);
    expect(cursorOnLine(at("a.ts", "old", 2), add(2))).toBe(false);
    expect(cursorOnLine(parked("a.ts"), ctx(1))).toBe(false);
    expect(cursorOnLine(null, ctx(1))).toBe(false);
  });
});

describe("hunk jumps", () => {
  it("jumps to the next hunk start within and across files", () => {
    expect(moveHunks(plain, "new", at("a.ts", "new", 1), 1)).toEqual(at("a.ts", "new", 10));
    expect(moveHunks(plain, "new", at("a.ts", "new", 10), 1)).toEqual(at("b.ts", "new", 1));
    expect(moveHunks(plain, "new", at("b.ts", "new", 2), 1)).toEqual(at("d.ts", "new", 5));
  });

  it("applies counts and stops at the last hunk it can reach", () => {
    expect(moveHunks(plain, "new", at("a.ts", "new", 1), 2)).toEqual(at("b.ts", "new", 1));
    expect(moveHunks(plain, "new", at("a.ts", "new", 1), 99)).toEqual(at("d.ts", "new", 5));
  });

  it("goes to the start of the current hunk before the previous one", () => {
    expect(moveHunks(plain, "new", at("a.ts", "new", 3), -1)).toEqual(at("a.ts", "new", 1));
    expect(moveHunks(plain, "new", at("a.ts", "new", 1), -1)).toBeNull();
    expect(moveHunks(plain, "new", at("b.ts", "new", 1), -1)).toEqual(at("a.ts", "new", 10));
  });

  it("does nothing past the last hunk", () => {
    expect(moveHunks(plain, "new", at("d.ts", "new", 6), 1)).toBeNull();
  });

  it("enters the first hunk of a parked file", () => {
    expect(moveHunks(plain, "new", parked("a.ts"), 1)).toEqual(at("a.ts", "new", 1));
  });
});

describe("file motion", () => {
  it("lands on the first line of the target file", () => {
    expect(moveFiles(plain, "new", at("a.ts", "new", 10), 1)).toEqual(at("b.ts", "new", 1));
    expect(moveFiles(plain, "new", at("b.ts", "new", 3), -1)).toEqual(at("a.ts", "new", 1));
  });

  it("parks on a gated, collapsed or binary file, and J leaves it again", () => {
    expect(moveFiles(plain, "new", at("b.ts", "new", 1), 1)).toEqual(parked("c.ts"));
    expect(moveFiles(plain, "new", parked("c.ts"), 1)).toEqual(at("d.ts", "new", 5));
    expect(moveFiles(plain, "old", at("b.ts", "new", 1), 1)).toEqual({ path: "c.ts", side: "old", line: FILE_LEVEL });
  });

  it("applies counts and does not move past either end", () => {
    expect(moveFiles(plain, "new", at("a.ts", "new", 1), 3)).toEqual(at("d.ts", "new", 5));
    expect(moveFiles(plain, "new", at("d.ts", "new", 5), 1)).toEqual(at("d.ts", "new", 5));
    expect(moveFiles(plain, "new", at("a.ts", "new", 3), -1)).toEqual(at("a.ts", "new", 3));
  });

  it("has nothing to do in an empty diff", () => {
    expect(moveFiles([], "new", parked("a.ts"), 1)).toBeNull();
  });
});

describe("gg, G and {count}G", () => {
  it("goes to the first and last line of the current file", () => {
    expect(firstLine(plain, "new", "a.ts")).toEqual(at("a.ts", "new", 1));
    expect(lastLine(plain, "new", "a.ts")).toEqual(at("a.ts", "new", 11));
    expect(lastLine(plain, "new", "b.ts")).toEqual(at("b.ts", "new", 3));
  });

  it("parks when the file has no lines", () => {
    expect(firstLine(plain, "new", "c.ts")).toEqual(parked("c.ts"));
    expect(lastLine(plain, "new", "c.ts")).toEqual(parked("c.ts"));
  });

  it("jumps to a new-side line number", () => {
    expect(goToLineNumber(plain, "new", "a.ts", 3)).toEqual(at("a.ts", "new", 3));
    expect(goToLineNumber(plain, "new", "a.ts", 11)).toEqual(at("a.ts", "new", 11));
  });

  it("falls back to the nearest existing line, earlier on a tie", () => {
    expect(goToLineNumber(plain, "new", "a.ts", 7)).toEqual(at("a.ts", "new", 10));
    expect(goToLineNumber(plain, "new", "a.ts", 5)).toEqual(at("a.ts", "new", 3));
    const gap = [view(file("g.ts", [hunk(ctx(2), ctx(4))]))];
    expect(goToLineNumber(gap, "new", "g.ts", 3)).toEqual(at("g.ts", "new", 2));
    expect(goToLineNumber(plain, "new", "a.ts", 900)).toEqual(at("a.ts", "new", 11));
  });

  it("uses old-side numbers on the old pane of a split file", () => {
    const split = [view(A, { split: true })];
    expect(goToLineNumber(split, "old", "a.ts", 2)).toEqual(at("a.ts", "old", 2));
  });

  it("uses old numbers for a file that only deletes", () => {
    const gone = file("gone.ts", [hunk(del(4), del(5))], { changeType: "deleted" });
    expect(goToLineNumber([view(gone)], "new", "gone.ts", 5)).toEqual(at("gone.ts", "old", 5));
  });
});

describe("keeping the anchor across a refresh", () => {
  it("keeps the same line when it still exists", () => {
    expect(reanchor(plain, "new", at("a.ts", "new", 10), "c10")).toEqual(at("a.ts", "new", 10));
  });

  it("follows the same text when it moved", () => {
    const shifted = [view(file("a.ts", [hunk(add(1, "x"), add(2, "y"), ctx(13, "c10"), add(14))]))];
    expect(reanchor(shifted, "new", at("a.ts", "new", 10), "c10")).toEqual(at("a.ts", "new", 13));
  });

  it("takes the nearest line when the text is gone", () => {
    const edited = [view(file("a.ts", [hunk(ctx(1), ctx(9, "other"), ctx(20, "far"))]))];
    expect(reanchor(edited, "new", at("a.ts", "new", 10), "gone")).toEqual(at("a.ts", "new", 9));
  });

  it("does not chase blank lines to a far spot", () => {
    const blank = [view(file("a.ts", [hunk(ctx(2, ""), ctx(30, ""))]))];
    expect(reanchor(blank, "new", at("a.ts", "new", 3), "")).toEqual(at("a.ts", "new", 2));
  });

  it("parks when the file lost its lines and returns null when the file left the diff", () => {
    expect(reanchor([view(A, { navigable: false })], "new", at("a.ts", "new", 1), "c1")).toEqual(parked("a.ts"));
    expect(reanchor([view(B)], "new", at("a.ts", "new", 1), "c1")).toBeNull();
  });

  it("reads the text under the cursor", () => {
    expect(contentAt(plain, "new", at("a.ts", "old", 2))).toBe("d2");
    expect(contentAt(plain, "new", parked("a.ts"))).toBeNull();
  });
});
