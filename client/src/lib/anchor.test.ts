import { describe, it, expect } from "vitest";
import type { Comment, DiffResult } from "$types";
import { partitionComments, isAnchored } from "./anchor";

const diff: DiffResult = {
  ref: "working tree",
  files: [
    {
      path: "a.ts",
      oldPath: null,
      changeType: "modified",
      additions: 1,
      deletions: 0,
      hunks: [{ header: "@@", lines: [{ type: "addition", oldLine: null, newLine: 5, content: "x" }] }],
    },
  ],
};

function comment(over: Partial<Comment>): Comment {
  return { id: "c", file: "a.ts", line: 5, lineContent: "x", text: "t", createdAt: "", ...over };
}

describe("anchor bridge (reuses core/anchor.ts)", () => {
  it("anchors a comment on a line still present in the diff", () => {
    expect(isAnchored(comment({ line: 5 }), diff)).toBe(true);
  });

  it("treats a comment on a vanished file or line as stale", () => {
    expect(isAnchored(comment({ file: "gone.ts" }), diff)).toBe(false);
    expect(isAnchored(comment({ line: 99 }), diff)).toBe(false);
  });

  it("partitions comments, preserving order", () => {
    const kept = comment({ id: "k", line: 5 });
    const lost = comment({ id: "l", line: 42 });
    const { anchored, stale } = partitionComments([kept, lost], diff);
    expect(anchored.map((c) => c.id)).toEqual(["k"]);
    expect(stale.map((c) => c.id)).toEqual(["l"]);
  });
});
