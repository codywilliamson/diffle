import { describe, expect, test } from "bun:test";
// pure client module, no dom — testable directly under bun.
import { lineCountOf, estimatedHeight, ROW_HEIGHT, resolveRepoPath } from "../src/client/util.js";

const file = (counts: number[]) => ({
  hunks: counts.map((n) => ({ header: "@@", lines: Array.from({ length: n }, () => ({})) })),
});

describe("lineCountOf", () => {
  test("sums lines across hunks", () => {
    expect(lineCountOf(file([3, 4]))).toBe(7);
  });
  test("zero for no hunks (binary)", () => {
    expect(lineCountOf(file([]))).toBe(0);
  });
});

describe("estimatedHeight", () => {
  test("scales with line count plus a hunk header row per hunk", () => {
    expect(estimatedHeight(file([10]))).toBe(11 * ROW_HEIGHT);
  });
  test("has a floor for empty files", () => {
    expect(estimatedHeight(file([]))).toBeGreaterThan(0);
  });
});

describe("resolveRepoPath", () => {
  test("resolves relative to the file's folder", () => {
    expect(resolveRepoPath("docs/guide.md", "screenshots/a.png")).toBe("docs/screenshots/a.png");
    expect(resolveRepoPath("README.md", "docs/a.png")).toBe("docs/a.png");
  });
  test("collapses ./ and ../ segments", () => {
    expect(resolveRepoPath("docs/adr/0001.md", "../media/x.gif")).toBe("docs/media/x.gif");
    expect(resolveRepoPath("docs/guide.md", "./a.png")).toBe("docs/a.png");
    expect(resolveRepoPath("docs/guide.md", "../../a.png")).toBe("a.png");
  });
  test("treats a leading slash as the repo root", () => {
    expect(resolveRepoPath("docs/guide.md", "/assets/logo.svg")).toBe("assets/logo.svg");
  });
});
