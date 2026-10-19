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

describe("targetOf", () => {
  it("takes the range start and keeps the uri when there is one", () => {
    const range = { start: { line: 7, character: 4 }, end: { line: 7, character: 9 } };
    expect(targetOf({ path: "a.ts", absolutePath: "/r/a.ts", inRepo: true, uri: "file:///r/a.ts" }, range)).toEqual({
      path: "a.ts", absolutePath: "/r/a.ts", uri: "file:///r/a.ts", inRepo: true, line: 7, character: 4,
    });
    expect(targetOf({ path: "a.ts", absolutePath: "/r/a.ts", inRepo: true }, range)).not.toHaveProperty("uri");
  });
});
