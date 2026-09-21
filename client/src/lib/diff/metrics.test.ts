import { describe, it, expect } from "vitest";
import type { DiffFile, DiffLine } from "$types";
import { lineCountOf, estimatedHeight, GIANT_FILE_LINES } from "./metrics";

const ctx: DiffLine = { type: "context", oldLine: 1, newLine: 1, content: "x" };
const file = (lines: number): DiffFile => ({
  path: "a.ts",
  oldPath: null,
  changeType: "modified",
  additions: 0,
  deletions: 0,
  hunks: [{ header: "@@", lines: Array.from({ length: lines }, () => ctx) }],
});

describe("diff metrics", () => {
  it("counts lines across hunks", () => {
    expect(lineCountOf(file(5))).toBe(5);
  });

  it("estimates a height that grows with line count", () => {
    expect(estimatedHeight(file(100))).toBeGreaterThan(estimatedHeight(file(10)));
  });

  it("exposes a giant-file threshold", () => {
    expect(GIANT_FILE_LINES).toBeGreaterThan(1000);
  });
});
