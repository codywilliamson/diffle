import { describe, expect, it } from "vitest";
import type { DiffFile, DiffLine } from "$types";
import {
  MAX_RANGES_PER_LINE, MAX_SCAN_LINE_CHARS, compileQuery, findFileMatches, groupByLine, markHits, orderOfCursor, rangesInLine, stepTarget,
} from "./search";

const ranges = (query: string, text: string) => {
  const regex = compileQuery(query);
  return regex ? rangesInLine(regex, text).map((r) => [r.start, r.end]) : [];
};

function fileOf(...contents: string[]): DiffFile {
  const lines: DiffLine[] = contents.map((content, i) => ({ type: "context", content, oldLine: i + 1, newLine: i + 1 }));
  return { path: "a.ts", hunks: [{ header: "@@", lines }] } as unknown as DiffFile;
}

describe("rangesInLine", () => {
  it("finds every occurrence, never overlapping", () => {
    expect(ranges("ab", "ab ab ab")).toEqual([[0, 2], [3, 5], [6, 8]]);
    expect(ranges("aa", "aaaa")).toEqual([[0, 2], [2, 4]]);
    expect(ranges("aa", "aaa")).toEqual([[0, 2]]);
  });

  it("treats the query as literal text", () => {
    expect(ranges("a.b", "axb a.b")).toEqual([[4, 7]]);
    expect(ranges("(x)", "f(x)")).toEqual([[1, 4]]);
  });

  it("is smartcase", () => {
    expect(ranges("foo", "Foo FOO foo")).toEqual([[0, 3], [4, 7], [8, 11]]);
    expect(ranges("Foo", "Foo FOO foo")).toEqual([[0, 3]]);
    expect(ranges("fOO", "Foo FOO foo")).toEqual([]);
  });

  it("keeps a trailing carriage return out of the match", () => {
    expect(ranges("end", "the end\r")).toEqual([[4, 7]]);
    expect(ranges("\r", "x\r")).toEqual([]);
  });

  it("returns utf-16 offsets for emoji and cjk", () => {
    expect(ranges("b", "a😀b")).toEqual([[3, 4]]);
    expect(ranges("😀", "a😀b😀")).toEqual([[1, 3], [4, 6]]);
    expect(ranges("日本", "x日本語日本")).toEqual([[1, 3], [4, 6]]);
  });

  it("caps a very long line and the ranges it yields", () => {
    const long = "x".repeat(MAX_SCAN_LINE_CHARS) + "needle";
    expect(ranges("needle", long)).toEqual([]);
    expect(ranges("x", "x".repeat(MAX_SCAN_LINE_CHARS * 2))).toHaveLength(MAX_RANGES_PER_LINE);
  });

  it("never cuts an emoji in half at the scan cap", () => {
    const text = "a".repeat(MAX_SCAN_LINE_CHARS - 1) + "😀😀";
    const found = ranges("😀", text);
    expect(found).toEqual([]);
  });

  it("finds nothing for an empty query", () => {
    expect(ranges("", "abc")).toEqual([]);
  });
});

describe("findFileMatches", () => {
  it("numbers matches in reading order with their line", () => {
    const matches = findFileMatches(fileOf("foo bar", "none", "foo foo"), "foo");
    expect(matches.map((m) => [m.index, m.order, m.newLine, m.start])).toEqual([[0, 0, 1, 0], [1, 2, 3, 0], [2, 2, 3, 4]]);
  });

  it("groups matches by line for rendering", () => {
    const byLine = groupByLine(findFileMatches(fileOf("foo foo", "x"), "foo"));
    expect(byLine.get("1:1")).toEqual([{ index: 0, start: 0, end: 3 }, { index: 1, start: 4, end: 7 }]);
    expect(byLine.has("2:2")).toBe(false);
  });
});

describe("markHits", () => {
  it("marks every hit and the active one differently", () => {
    const html = markHits("foo foo", [{ index: 0, start: 0, end: 3 }, { index: 1, start: 4, end: 7 }], 1);
    expect(html).toBe('<mark class="sm">foo</mark> <mark class="sm sm-active">foo</mark>');
  });

  it("marks across syntax spans", () => {
    expect(markHits('<span class="k">fo</span>o', [{ index: 0, start: 0, end: 3 }], -1)).toBe(
      '<span class="k"><mark class="sm">fo</mark></span><mark class="sm">o</mark>',
    );
  });

  it("nests inside a word-diff mark without leaving empty marks", () => {
    const html = markHits('<mark class="wd">LINE</mark> 5', [{ index: 0, start: 0, end: 4 }], 0);
    expect(html).not.toMatch(/<mark[^>]*><\/mark>/);
    expect(html).toContain('<mark class="sm sm-active">LINE</mark>');
  });

  it("leaves a line without hits alone", () => {
    expect(markHits("<b>x</b>", undefined, 0)).toBe("<b>x</b>");
  });
});

describe("stepping", () => {
  const matches = findFileMatches(fileOf("a", "x", "a", "x", "a"), "a"); // orders 0, 2, 4

  it("walks forward and wraps at the end", () => {
    expect(stepTarget(matches, 0, 1, -1)).toBe(1);
    expect(stepTarget(matches, 2, 1, -1)).toBe(0);
  });

  it("walks backward and wraps at the start", () => {
    expect(stepTarget(matches, 1, -1, -1)).toBe(0);
    expect(stepTarget(matches, 0, -1, -1)).toBe(2);
  });

  it("applies a count, including more than a full lap", () => {
    expect(stepTarget(matches, 0, 2, -1)).toBe(2);
    expect(stepTarget(matches, 0, 4, -1)).toBe(1);
    expect(stepTarget(matches, 0, -4, -1)).toBe(2);
  });

  it("starts at the first match at or after the cursor", () => {
    expect(stepTarget(matches, -1, 1, 1)).toBe(1);
    expect(stepTarget(matches, -1, 1, 2)).toBe(1);
    expect(stepTarget(matches, -1, 1, 5)).toBe(0);
    expect(stepTarget(matches, -1, 1, -1)).toBe(0);
  });

  it("starts backward at the nearest match before the cursor, else the last", () => {
    expect(stepTarget(matches, -1, -1, 3)).toBe(1);
    expect(stepTarget(matches, -1, -1, 0)).toBe(2);
    expect(stepTarget(matches, -1, -1, -1)).toBe(2);
  });

  it("goes nowhere without matches", () => {
    expect(stepTarget([], -1, 1, 0)).toBe(-1);
  });
});

describe("orderOfCursor", () => {
  it("finds the cursor line in reading order", () => {
    const file = fileOf("a", "b", "c");
    expect(orderOfCursor(file, { path: "a.ts", side: "new", line: 2 })).toBe(1);
    expect(orderOfCursor(file, { path: "other.ts", side: "new", line: 2 })).toBe(-1);
    expect(orderOfCursor(file, null)).toBe(-1);
  });
});
