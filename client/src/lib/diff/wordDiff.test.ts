import { describe, it, expect } from "vitest";
import type { DiffLine } from "$types";
import { pairLines, diffRange, hunkMarks, markRange } from "./wordDiff";

const ctx = (content: string, n: number): DiffLine => ({ type: "context", oldLine: n, newLine: n, content });
const del = (content: string, n: number): DiffLine => ({ type: "deletion", oldLine: n, newLine: null, content });
const add = (content: string, n: number): DiffLine => ({ type: "addition", oldLine: null, newLine: n, content });

describe("pairLines", () => {
  it("spans context across both columns and pairs del/add runs", () => {
    const rows = pairLines([ctx("a", 1), del("b", 2), add("B", 2), del("c", 3)]);
    expect(rows[0]).toEqual({ left: rows[0]!.left, right: rows[0]!.left }); // context shared
    expect(rows[1]!.left?.type).toBe("deletion");
    expect(rows[1]!.right?.type).toBe("addition");
    expect(rows[2]!.left?.type).toBe("deletion"); // extra deletion, no addition
    expect(rows[2]!.right).toBeNull();
  });
});

describe("diffRange", () => {
  it("returns null for identical text and text with nothing in common", () => {
    expect(diffRange("same", "same")).toBeNull();
    expect(diffRange("abc", "xyz")).toBeNull();
  });

  it("finds the differing middle via common prefix/suffix", () => {
    const r = diffRange("const a = 1;", "const a = 2;");
    expect(r).not.toBeNull();
    expect("const a = ".length).toBe(r!.old.start);
    expect(r!.old.end).toBe(r!.old.start + 1);
  });
});

describe("hunkMarks", () => {
  it("marks the changed range on a del/add pair", () => {
    const marks = hunkMarks([del("value = 1", 1), add("value = 2", 1)]);
    expect(marks.size).toBe(2);
  });
});

describe("markRange", () => {
  it("wraps the char range in a mark and steps over tags", () => {
    const out = markRange("ab<span>cd</span>", 1, 3, "w");
    expect(out).toContain('<mark class="w">');
    expect(out).toContain("</mark>");
    expect(out.indexOf("<span>")).toBeGreaterThan(-1);
  });

  it("returns the input unchanged for an empty range", () => {
    expect(markRange("abc", 2, 2, "w")).toBe("abc");
  });
});
