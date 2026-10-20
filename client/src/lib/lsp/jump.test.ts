import { describe, expect, it, vi } from "vitest";
import type { DiffFile } from "$types";
import { jumpTo, targetOf, type JumpTarget } from "./jump";

const file = (path: string, newLines: number[]): DiffFile =>
  ({
    path, changeType: "modified", binary: false, additions: 0, deletions: 0,
    hunks: [{ header: "@@", lines: newLines.map((n) => ({ type: "addition", oldLine: null, newLine: n, content: "x" })) }],
  }) as unknown as DiffFile;

const target = (over: Partial<JumpTarget>): JumpTarget => ({ path: "a.ts", absolutePath: "/r/a.ts", inRepo: true, line: 3, character: 0, ...over });

function setup(files: DiffFile[]) {
  const toDiff = vi.fn();
  const toViewer = vi.fn();
  return { toDiff, toViewer, deps: { files: () => files, toDiff, toViewer } };
}

describe("jumpTo", () => {
  it("moves the cursor when the diff shows the line", () => {
    const { deps, toDiff, toViewer } = setup([file("a.ts", [2, 3, 4])]);
    expect(jumpTo(deps, target({}))).toBe("diff");
    expect(toDiff).toHaveBeenCalledWith({ path: "a.ts", side: "new", line: 3, preview: "", ranges: [] });
    expect(toViewer).not.toHaveBeenCalled();
  });

  it("opens the viewer for a changed file's line outside every hunk", () => {
    const { deps, toViewer } = setup([file("a.ts", [20])]);
    expect(jumpTo(deps, target({}))).toBe("viewer");
    expect(toViewer).toHaveBeenCalledOnce();
  });

  it("opens the viewer for an unchanged repo file", () => {
    const { deps } = setup([file("a.ts", [3])]);
    expect(jumpTo(deps, target({ path: "src/other.ts" }))).toBe("viewer");
  });

  it("opens the viewer for a path outside the repo", () => {
    const { deps, toViewer } = setup([file("a.ts", [3])]);
    jumpTo(deps, target({ path: null, inRepo: false, absolutePath: "/usr/lib/lib.d.ts" }));
    expect(toViewer.mock.calls[0]![0].absolutePath).toBe("/usr/lib/lib.d.ts");
  });

  it("never lands in a binary file", () => {
    const binary = { ...file("a.ts", [3]), binary: true } as DiffFile;
    expect(jumpTo(setup([binary]).deps, target({}))).toBe("viewer");
  });
});

describe("jumpTo on the old side", () => {
  const oldFile = (path: string, oldPath: string | null, lines: [number | null, number | null][]): DiffFile =>
    ({
      path, oldPath, changeType: "modified", binary: false, additions: 0, deletions: 0,
      hunks: [{ header: "@@", lines: lines.map(([o, n]) => ({ type: n === null ? "deletion" : o === null ? "addition" : "context", oldLine: o, newLine: n, content: "x" })) }],
    }) as unknown as DiffFile;

  it("lands on the old line, not the new line with the same number", () => {
    // old 3 is a removed line; new 3 is a different, added line
    const { deps, toDiff } = setup([oldFile("a.ts", null, [[2, 2], [3, null], [null, 3]])]);
    expect(jumpTo(deps, target({ side: "old", line: 3 }))).toBe("diff");
    expect(toDiff).toHaveBeenCalledWith({ path: "a.ts", side: "old", line: 3, preview: "", ranges: [] });
  });

  it("opens the viewer when the old line is outside every hunk, even if the new side shows that number", () => {
    const { deps, toDiff, toViewer } = setup([oldFile("a.ts", null, [[null, 3]])]);
    expect(jumpTo(deps, target({ side: "old", line: 3 }))).toBe("viewer");
    expect(toDiff).not.toHaveBeenCalled();
    expect(toViewer.mock.calls[0]![0].side).toBe("old");
  });

  it("finds a renamed file by its old path and reports that path", () => {
    const { deps, toDiff } = setup([oldFile("new/a.ts", "old/a.ts", [[3, 5]])]);
    expect(jumpTo(deps, target({ path: "old/a.ts", side: "old", line: 3 }))).toBe("diff");
    expect(toDiff.mock.calls[0]![0]).toMatchObject({ path: "old/a.ts", side: "old", line: 3 });
  });
});

describe("targetOf", () => {
  it("carries the old side through", () => {
    const range = { start: { line: 2, character: 0 }, end: { line: 2, character: 1 } };
    expect(targetOf({ path: "a.ts", absolutePath: "/w/a.ts", inRepo: true, side: "old" }, range).side).toBe("old");
    expect(targetOf({ path: "a.ts", absolutePath: "/r/a.ts", inRepo: true }, range)).not.toHaveProperty("side");
  });

  it("takes the range start and keeps the uri when there is one", () => {
    const range = { start: { line: 7, character: 4 }, end: { line: 7, character: 9 } };
    expect(targetOf({ path: "a.ts", absolutePath: "/r/a.ts", inRepo: true, uri: "file:///r/a.ts" }, range)).toEqual({
      path: "a.ts", absolutePath: "/r/a.ts", uri: "file:///r/a.ts", inRepo: true, line: 7, character: 4,
    });
    expect(targetOf({ path: "a.ts", absolutePath: "/r/a.ts", inRepo: true }, range)).not.toHaveProperty("uri");
  });
});
