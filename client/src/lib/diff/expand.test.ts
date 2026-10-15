import { describe, it, expect } from "vitest";
import type { DiffFile, DiffLine } from "$types";
import { EXPAND_STEP, expandFile, gapsOf, headerRow, linesLabel, matchesText, mergeReveals, nextReveal, revealsFor, splitLines } from "./expand";

// a 100-line file; line n reads "L<n>". hunk A changes line 30 (context 27–33), hunk B deletes
// old line 61 (new 60) with context, so after it old = new + 1.
const text = Array.from({ length: 100 }, (_, i) => `L${i + 1}`);
const ctx = (n: number, offset: number): DiffLine => ({ type: "context", oldLine: n + offset, newLine: n, content: `L${n}` });
const file: DiffFile = {
  path: "a.ts", oldPath: null, changeType: "modified", additions: 1, deletions: 2,
  hunks: [
    {
      header: "@@ -27,7 +27,7 @@ function a()",
      lines: [ctx(27, 0), ctx(28, 0), ctx(29, 0), { type: "deletion", oldLine: 30, newLine: null, content: "old" }, { type: "addition", oldLine: null, newLine: 30, content: "L30" }, ctx(31, 0), ctx(32, 0), ctx(33, 0)],
    },
    {
      header: "@@ -58,6 +58,5 @@",
      lines: [ctx(58, 0), ctx(59, 0), ctx(60, 0), { type: "deletion", oldLine: 61, newLine: null, content: "gone" }, ctx(61, 1), ctx(62, 1)],
    },
  ],
};

describe("gapsOf", () => {
  it("finds the gaps before, between and after the hunks with their old-line offsets", () => {
    expect(gapsOf(file, 100)).toEqual([
      { index: 0, start: 1, end: 26, offset: 0, above: false, below: true },
      { index: 1, start: 34, end: 57, offset: 0, above: true, below: true },
      { index: 2, start: 63, end: 100, offset: 1, above: true, below: false },
    ]);
  });

  it("handles pure insertions and deletions at the edges", () => {
    const insert: DiffFile = { ...file, hunks: [{ header: "@@ -5,0 +6,1 @@", lines: [{ type: "addition", oldLine: null, newLine: 6, content: "x" }] }] };
    expect(gapsOf(insert, 10)?.map((g) => [g.start, g.end, g.offset])).toEqual([[1, 5, 0], [7, 10, -1]]);
    const remove: DiffFile = { ...file, hunks: [{ header: "@@ -6,2 +5,0 @@", lines: [{ type: "deletion", oldLine: 6, newLine: null, content: "x" }, { type: "deletion", oldLine: 7, newLine: null, content: "y" }] }] };
    expect(gapsOf(remove, 10)?.map((g) => [g.start, g.end, g.offset])).toEqual([[1, 5, 0], [6, 10, 2]]);
  });

  it("refuses headers that are missing, wrong, or run past the text", () => {
    expect(gapsOf({ ...file, hunks: [{ ...file.hunks[0]!, header: "" }] }, 100)).toBeNull();
    expect(gapsOf({ ...file, hunks: [{ ...file.hunks[0]!, header: "@@ -27,7 +28,7 @@" }] }, 100)).toBeNull();
    expect(gapsOf(file, 50)).toBeNull();
    expect(gapsOf({ ...file, hunks: [] }, 100)).toBeNull();
  });
});

describe("expandFile", () => {
  const gaps = gapsOf(file, 100)!;

  it("changes nothing without reveals", () => {
    const { file: out, views } = expandFile(file, gaps, text, new Map());
    expect(out.hunks.map((h) => h.lines.length)).toEqual([8, 6]);
    expect(views.map((v) => [v.hidden, v.revealed, v.canDown, v.canUp])).toEqual([[26, false, false, true], [24, false, true, true], [38, false, true, false]]);
  });

  it("grows hunks into the gaps as context lines with the right numbers", () => {
    const reveals = new Map([[0, { top: 0, bottom: 3 }], [1, { top: 2, bottom: 1 }], [2, { top: 2, bottom: 0 }]]);
    const { file: out, views } = expandFile(file, gaps, text, reveals);
    const numbers = (h: number) => out.hunks[h]!.lines.map((l) => [l.oldLine, l.newLine]);
    expect(numbers(0).slice(0, 3)).toEqual([[24, 24], [25, 25], [26, 26]]);
    expect(numbers(0).slice(-2)).toEqual([[34, 34], [35, 35]]);
    expect(numbers(1)[0]).toEqual([57, 57]);
    expect(numbers(1).slice(-2)).toEqual([[64, 63], [65, 64]]);
    expect(out.hunks[1]!.lines.at(-1)).toMatchObject({ type: "context", content: "L64" });
    expect(views.map((v) => v.hidden)).toEqual([23, 21, 36]);
    expect(file.hunks[0]!.lines).toHaveLength(8); // input untouched
  });

  it("never shows a line twice when reveals overlap", () => {
    const { file: out, views } = expandFile(file, gaps, text, new Map([[1, { top: 20, bottom: 20 }]]));
    const shownNew = out.hunks.flatMap((h) => h.lines.map((l) => l.newLine)).filter((n): n is number => n != null);
    expect(new Set(shownNew).size).toBe(shownNew.length);
    expect(views[1]).toMatchObject({ hidden: 0, canDown: false, canUp: false });
  });
});

describe("nextReveal / revealsFor / mergeReveals", () => {
  const gaps = gapsOf(file, 100)!;

  it("steps by EXPAND_STEP and reveals a whole gap from its usable side", () => {
    expect(nextReveal(gaps[1]!, { top: 0, bottom: 0 }, "down")).toEqual({ top: EXPAND_STEP, bottom: 0 });
    expect(nextReveal(gaps[1]!, { top: 5, bottom: 0 }, "up")).toEqual({ top: 5, bottom: EXPAND_STEP });
    expect(nextReveal(gaps[0]!, { top: 0, bottom: 0 }, "all")).toEqual({ top: 0, bottom: 26 });
    expect(nextReveal(gaps[2]!, { top: 0, bottom: 0 }, "all")).toEqual({ top: 38, bottom: 0 });
  });

  it("reveals hidden comment lines from the nearer side", () => {
    const needed = revealsFor(gaps, [{ start: 36, end: 37 }, { start: 55, end: 55 }, { start: 5, end: 5 }, { start: 90, end: 90 }, { start: 30, end: 30 }]);
    expect(needed.get(1)).toEqual({ top: 4, bottom: 3 });
    expect(needed.get(0)).toEqual({ top: 0, bottom: 22 });
    expect(needed.get(2)).toEqual({ top: 28, bottom: 0 });
    expect(mergeReveals(new Map([[1, { top: 10, bottom: 0 }]]), needed).get(1)).toEqual({ top: 10, bottom: 3 });
  });
});

describe("headerRow / splitLines", () => {
  it("shows git's header, an expander label, or nothing", () => {
    const view = { index: 1, size: 24, hidden: 24, revealed: false, canDown: true, canUp: true };
    expect(headerRow(undefined, "@@ x @@")).toEqual({ show: true, label: "@@ x @@" });
    expect(headerRow(view, "@@ x @@")).toEqual({ show: true, label: "@@ x @@" });
    expect(headerRow({ ...view, hidden: 4, revealed: true }, "@@ x @@")).toEqual({ show: true, label: "4 hidden lines" });
    expect(headerRow({ ...view, hidden: 0, revealed: true }, "@@ x @@").show).toBe(false);
    expect(headerRow({ ...view, size: 0, hidden: 0 }, "@@ -1 +1 @@").show).toBe(true);
  });

  it("drops only the trailing newline's empty line", () => {
    expect(splitLines("a\r\nb\n")).toEqual(["a", "b"]);
    expect(splitLines("a\n\n")).toEqual(["a", ""]);
  });
});

describe("matchesText", () => {
  it("accepts the text the diff was made from and refuses a later edit", () => {
    expect(matchesText(file, text)).toBe(true);
    expect(matchesText(file, ["inserted", ...text])).toBe(false);
    expect(matchesText(file, text.slice(0, 50))).toBe(false);
  });

  it("refuses text whose length differs from the server's line count", () => {
    expect(matchesText({ ...file, lineCount: 100 }, text)).toBe(true);
    expect(matchesText({ ...file, lineCount: 90 }, text)).toBe(false);
  });

  it("ignores a carriage return git leaves on a crlf line", () => {
    const crlf = { ...file, hunks: file.hunks.map((h) => ({ ...h, lines: h.lines.map((l) => ({ ...l, content: `${l.content}\r` })) })) };
    expect(matchesText(crlf, text)).toBe(true);
  });
});

describe("linesLabel", () => {
  it("says line for one and lines otherwise", () => {
    expect(linesLabel(1, "more")).toBe("1 more line");
    expect(linesLabel(4, "hidden")).toBe("4 hidden lines");
  });
});
