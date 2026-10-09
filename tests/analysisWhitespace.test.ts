import { describe, expect, test } from "bun:test";
import { countChangedLines, whitespaceOnlyHunks } from "../src/core/analysis/whitespace";
import { file, hunk } from "./fixtures/analysis/diffBuilders";

describe("whitespaceOnlyHunks", () => {
  test("reindented c# block is whitespace-only", () => {
    const f = file("A.cs", [
      hunk(1, 1, ["-    public void Run()", "-    {", "-        Go();", "-    }", "+        public void Run()", "+        {", "+            Go();", "+        }"]),
    ]);
    expect(whitespaceOnlyHunks(f)).toEqual([0]);
  });

  test("rewrapped ts line is whitespace-only", () => {
    const f = file("a.ts", [hunk(1, 1, ["-const x = foo(a, b);", "+const x = foo(", "+  a,", "+  b,", "+);"])]);
    expect(whitespaceOnlyHunks(f)).toEqual([]);
    const g = file("a.ts", [hunk(1, 1, ["-const x = foo(a, b);", "+const  x =  foo(a,   b);"])]);
    expect(whitespaceOnlyHunks(g)).toEqual([0]);
  });

  test("joining or splitting tokens is a real change", () => {
    expect(whitespaceOnlyHunks(file("a.ts", [hunk(1, 1, ["-foo bar", "+foobar"])]))).toEqual([]);
    expect(whitespaceOnlyHunks(file("a.ts", [hunk(1, 1, ['-const s = "a b";', '+const s = "ab";'])]))).toEqual([]);
    expect(whitespaceOnlyHunks(file("a.ts", [hunk(1, 1, ["-foo(a, b)", "+foo( a, b )"])]))).toEqual([]);
  });

  test("line rewrap on token boundaries is whitespace-only", () => {
    expect(whitespaceOnlyHunks(file("a.ts", [hunk(1, 1, ["-const x = a + b;", "+const x = a +", "+  b;"])]))).toEqual([0]);
  });

  test("real change is not whitespace-only", () => {
    const f = file("a.ts", [hunk(1, 1, ["-const x = 1;", "+const x = 2;"])]);
    expect(whitespaceOnlyHunks(f)).toEqual([]);
  });

  test("picks only the matching hunks by index", () => {
    const f = file("a.ts", [hunk(1, 1, ["-a = 1;", "+a = 2;"]), hunk(20, 20, ["-  b();", "+    b();"])]);
    expect(whitespaceOnlyHunks(f)).toEqual([1]);
  });

  test("hunk with no changes is ignored", () => {
    const f = file("a.ts", [hunk(1, 1, [" same", " lines"])]);
    expect(whitespaceOnlyHunks(f)).toEqual([]);
  });

  test("binary file and empty diff yield nothing", () => {
    expect(whitespaceOnlyHunks({ ...file("img.png", []), binary: true })).toEqual([]);
    expect(whitespaceOnlyHunks(file("a.ts", []))).toEqual([]);
  });

  test("countChangedLines skips context", () => {
    expect(countChangedLines(hunk(1, 1, [" c", "-a", "+b", "+c"]))).toBe(3);
  });
});
