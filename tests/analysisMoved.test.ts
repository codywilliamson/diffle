import { describe, expect, test } from "bun:test";
import { detectMovedBlocks, movedLineCount } from "../src/core/analysis/moved";
import { file, hunk } from "./fixtures/analysis/diffBuilders";

const method = ["    public int Total(int a, int b)", "    {", "        var sum = a + b;", "        Log(sum);", "        return sum;", "    }"];
const del = (lines: string[]) => lines.map((l) => `-${l}`);
const add = (lines: string[]) => lines.map((l) => `+${l}`);

describe("detectMovedBlocks", () => {
  test("c# method moved between files, verbatim", () => {
    const from = file("Old.cs", [hunk(10, 10, del(method))]);
    const to = file("New.cs", [hunk(4, 4, add(method))]);
    const blocks = detectMovedBlocks([from, to]);
    expect(blocks).toEqual([{ from: { file: "Old.cs", start: 10, end: 15 }, to: { file: "New.cs", start: 4, end: 9 }, edited: false }]);
  });

  test("reindented move still counts as verbatim", () => {
    const from = file("Old.cs", [hunk(1, 1, del(method))]);
    const to = file("New.cs", [hunk(1, 1, add(method.map((l) => "    " + l)))]);
    expect(detectMovedBlocks([from, to])[0]?.edited).toBe(false);
  });

  test("brace-only lines never form a move", () => {
    const braces = ["    }", "    }", "    {", "    }", "});"];
    const blocks = detectMovedBlocks([file("A.cs", [hunk(1, 1, del(braces))]), file("B.cs", [hunk(1, 1, add(braces))])]);
    expect(blocks).toEqual([]);
  });

  test("block shorter than 3 non-trivial lines is ignored", () => {
    const two = ["int a = Compute();", "int b = Other();"];
    expect(detectMovedBlocks([file("A.ts", [hunk(1, 1, del(two))]), file("B.ts", [hunk(1, 1, add(two))])])).toEqual([]);
  });

  test("trivial lines do not count toward the minimum", () => {
    const lines = ["foo();", "}", "bar();", "}"];
    expect(detectMovedBlocks([file("A.ts", [hunk(1, 1, del(lines))]), file("B.ts", [hunk(1, 1, add(lines))])])).toEqual([]);
  });

  test("same-file move", () => {
    const body = ["const a = load();", "const b = parse(a);", "const c = check(b);", "save(c);"];
    const f = file("svc.ts", [hunk(5, 5, [...del(body), " keep();"]), hunk(40, 36, [" ctx();", ...add(body)])]);
    const blocks = detectMovedBlocks([f]);
    expect(blocks).toEqual([{ from: { file: "svc.ts", start: 5, end: 8 }, to: { file: "svc.ts", start: 37, end: 40 }, edited: false }]);
  });

  test("one edited line inside the block marks it edited", () => {
    const before = ["const a = load();", "const b = parse(a);", "const c = check(b);", "save(c);", "done(c);"];
    const after = ["const a = load();", "const b = parse(a, true);", "const c = check(b);", "save(c);", "done(c);"];
    const blocks = detectMovedBlocks([file("a.ts", [hunk(1, 1, del(before))]), file("b.ts", [hunk(1, 1, add(after))])]);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ from: { start: 1, end: 5 }, to: { start: 1, end: 5 }, edited: true });
  });

  test("two differing lines in a row break the block", () => {
    const before = ["one();", "two();", "three();", "x1();", "x2();", "four();", "five();"];
    const after = ["one();", "two();", "three();", "y1();", "y2();", "four();", "five();"];
    const blocks = detectMovedBlocks([file("a.ts", [hunk(1, 1, del(before))]), file("b.ts", [hunk(1, 1, add(after))])]);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ from: { start: 1, end: 3 }, edited: false });
  });

  test("genuinely new code is not a move", () => {
    const a = file("a.ts", [hunk(1, 1, del(["alpha();", "beta();", "gamma();"]))]);
    const b = file("b.ts", [hunk(1, 1, add(["delta();", "epsilon();", "zeta();"]))]);
    expect(detectMovedBlocks([a, b])).toEqual([]);
  });

  test("output is sorted by source file then line", () => {
    const m1 = ["m1a();", "m1b();", "m1c();"];
    const m2 = ["m2a();", "m2b();", "m2c();"];
    const src = file("z.ts", [hunk(1, 1, del(m1)), hunk(30, 30, del(m2))]);
    const dst = file("a.ts", [hunk(1, 1, add([...m2, ...m1]))]);
    const blocks = detectMovedBlocks([dst, src]);
    expect(blocks.map((b) => b.from.start)).toEqual([1, 30]);
    expect(blocks.every((b) => b.from.file === "z.ts")).toBe(true);
  });

  test("binary file and empty diff", () => {
    expect(detectMovedBlocks([])).toEqual([]);
    expect(detectMovedBlocks([{ ...file("img.png", []), binary: true }])).toEqual([]);
  });
});

describe("movedLineCount", () => {
  test("counts both sides per file", () => {
    const blocks = detectMovedBlocks([file("Old.cs", [hunk(10, 10, del(method))]), file("New.cs", [hunk(4, 4, add(method))])]);
    expect(movedLineCount(blocks, "Old.cs")).toBe(6);
    expect(movedLineCount(blocks, "New.cs")).toBe(6);
    expect(movedLineCount(blocks, "Other.cs")).toBe(0);
  });
});
