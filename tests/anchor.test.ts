import { describe, it, expect } from "bun:test";
import { isAnchored, partitionComments } from "../src/core/anchor";
import type { DiffResult, Comment, DiffFile, DiffLine } from "../src/types";

// a 5-line modified file: lines 1-5 on the new side, line 3 also a deletion on the old side.
const lines: DiffLine[] = [
  { type: "context", oldLine: 1, newLine: 1, content: "one" },
  { type: "context", oldLine: 2, newLine: 2, content: "two" },
  { type: "deletion", oldLine: 3, newLine: null, content: "gone three" },
  { type: "addition", oldLine: null, newLine: 3, content: "new three" },
  { type: "context", oldLine: 4, newLine: 4, content: "four" },
  { type: "context", oldLine: 5, newLine: 5, content: "five" },
];

const file: DiffFile = {
  path: "a.ts", oldPath: null, changeType: "modified", additions: 1, deletions: 1, hunks: [{ header: "@@", lines }],
};

const diff: DiffResult = { ref: "wt", files: [file] };

function comment(over: Partial<Comment>): Comment {
  return { id: "c1", file: "a.ts", line: 2, lineContent: null, text: "t", createdAt: "2026-06-01T00:00:00Z", ...over };
}

describe("isAnchored", () => {
  it("anchors a new-side line comment whose number is present in the diff", () => {
    expect(isAnchored(comment({ line: 2 }), diff)).toBe(true);
  });

  it("does not anchor a line comment whose number is absent from the diff", () => {
    expect(isAnchored(comment({ line: 999 }), diff)).toBe(false);
  });

  it("does not anchor any comment whose file is absent from the diff", () => {
    expect(isAnchored(comment({ file: "ghost.ts", line: 2 }), diff)).toBe(false);
    expect(isAnchored(comment({ file: "ghost.ts", line: null }), diff)).toBe(false);
  });

  it("anchors a file-level comment iff its file is present", () => {
    expect(isAnchored(comment({ line: null }), diff)).toBe(true);
  });

  it("anchors an old-side comment by its old-side line number", () => {
    expect(isAnchored(comment({ side: "old", line: 3 }), diff)).toBe(true);
    expect(isAnchored(comment({ side: "old", line: 3 }), diff)).not.toBe(false);
  });

  it("does not anchor an old-side comment whose old number only exists on the new side", () => {
    // new line 3 is an addition (no old number); an old-side comment on 3 must match a deletion's oldLine
    expect(isAnchored(comment({ side: "old", line: 4, lineContent: null }), diff)).toBe(true); // context line 4 has oldLine 4
    expect(isAnchored(comment({ side: "old", line: 99 }), diff)).toBe(false);
  });

  it("anchors a range if ANY line in [line, endLine] is present on its side", () => {
    // range 4-7: line 4 and 5 exist, 6/7 do not -> still anchored
    expect(isAnchored(comment({ line: 4, endLine: 7 }), diff)).toBe(true);
  });

  it("does not anchor a range whose every line is absent", () => {
    expect(isAnchored(comment({ line: 50, endLine: 60 }), diff)).toBe(false);
  });

  it("treats endLine null or equal-to-line as a single line", () => {
    expect(isAnchored(comment({ line: 5, endLine: null }), diff)).toBe(true);
    expect(isAnchored(comment({ line: 5, endLine: 5 }), diff)).toBe(true);
  });
});

describe("partitionComments", () => {
  it("splits comments into anchored and stale, preserving order", () => {
    const comments = [
      comment({ id: "a", line: 2 }),
      comment({ id: "b", file: "ghost.ts", line: 1 }),
      comment({ id: "c", line: 999 }),
      comment({ id: "d", line: null }),
    ];
    const { anchored, stale } = partitionComments(comments, diff);
    expect(anchored.map((c) => c.id)).toEqual(["a", "d"]);
    expect(stale.map((c) => c.id)).toEqual(["b", "c"]);
  });

  it("returns empty arrays for no comments", () => {
    expect(partitionComments([], diff)).toEqual({ anchored: [], stale: [] });
  });
});

describe("isAnchored with stored line content", () => {
  it("stays anchored when the stored line still sits at its number", () => {
    expect(isAnchored(comment({ line: 2, lineContent: " two" }), diff)).toBe(true);
    expect(isAnchored(comment({ line: 3, side: "old", lineContent: "-gone three" }), diff)).toBe(true);
  });

  it("goes stale when a different line now sits at its number", () => {
    expect(isAnchored(comment({ line: 2, lineContent: " some line that moved" }), diff)).toBe(false);
  });

  it("ignores the diff marker, so a context line that became an addition still matches", () => {
    expect(isAnchored(comment({ line: 3, lineContent: " new three" }), diff)).toBe(true);
  });

  it("anchors a range when the stored line is anywhere inside it", () => {
    expect(isAnchored(comment({ line: 2, endLine: 4, lineContent: " four" }), diff)).toBe(true);
    expect(isAnchored(comment({ line: 2, endLine: 4, lineContent: " five" }), diff)).toBe(false);
  });

  it("ignores trailing whitespace", () => {
    expect(isAnchored(comment({ line: 1, lineContent: " one  " }), diff)).toBe(true);
  });
});
