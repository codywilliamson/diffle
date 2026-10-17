import { describe, it, expect } from "bun:test";
import type { DiffFile } from "../src/types";
import { compilePattern, searchText, MAX_PREVIEW_CHARS, MAX_SEARCH_RESULTS, MAX_SCAN_LINE_CHARS } from "../src/core/search";
import { searchDiffFiles } from "../src/core/searchDiff";
import { oldSideRef } from "../src/core/searchBase";

const opts = { path: "f.txt", side: "new" as const, limit: 1000 };

describe("search previews", () => {
  it("centers a long line on the first match and keeps it visible", () => {
    const line = `${"a".repeat(1000)}NEEDLE${"b".repeat(1000)}`;
    const { hits } = searchText(line, compilePattern("needle", false, "smart"), opts);
    const hit = hits[0]!;
    expect(hit.preview.length).toBe(MAX_PREVIEW_CHARS);
    const [s, e] = hit.ranges[0]!;
    expect(hit.preview.slice(s, e)).toBe("NEEDLE");
    expect(s).toBeGreaterThan(50);
    expect(s).toBeLessThan(150);
  });

  it("never splits a surrogate pair at the window edges", () => {
    const line = `${"\u{1F600}".repeat(400)}x${"\u{1F600}".repeat(400)}`;
    const { hits } = searchText(line, compilePattern("x", false, "smart"), opts);
    const preview = hits[0]!.preview;
    expect(preview).not.toMatch(/^[\udc00-\udfff]/);
    expect(preview).not.toMatch(/[\ud800-\udbff]$/);
  });

  it("cuts very long lines before matching and flags truncation", () => {
    const line = `${"a".repeat(MAX_SCAN_LINE_CHARS + 50)}needle`;
    const result = searchText(line, compilePattern("needle", false, "smart"), opts);
    expect(result.hits).toEqual([]);
    expect(result.truncated).toBe(true);
  });

  it("stops a file when the time budget trips and flags truncation", () => {
    const text = Array.from({ length: 5000 }, () => "needle").join("\n");
    const result = searchText(text, compilePattern("needle", false, "smart"), { ...opts, budgetMs: 0 });
    expect(result.truncated).toBe(true);
    expect(result.hits.length).toBeLessThan(5000);
  });

  it("ignores zero-width regex matches", () => {
    const { hits } = searchText("abc\nxyz", compilePattern("q*", true, "smart"), opts);
    expect(hits).toEqual([]);
  });
});

describe("search cap", () => {
  it("stops at MAX_SEARCH_RESULTS and sets truncated", () => {
    const file: DiffFile = { path: "big.txt", oldPath: null, changeType: "added", additions: 0, deletions: 0, hunks: [] };
    const text = Array.from({ length: MAX_SEARCH_RESULTS + 25 }, () => "needle").join("\n");
    const out = searchDiffFiles([file], () => new TextEncoder().encode(text), compilePattern("needle", false, "smart"));
    expect(out.results.length).toBe(MAX_SEARCH_RESULTS);
    expect(out.truncated).toBe(true);
  });

  it("is not truncated when results land exactly on the cap", () => {
    const file: DiffFile = { path: "big.txt", oldPath: null, changeType: "added", additions: 0, deletions: 0, hunks: [] };
    const text = Array.from({ length: MAX_SEARCH_RESULTS }, () => "needle").join("\n");
    const out = searchDiffFiles([file], () => new TextEncoder().encode(text), compilePattern("needle", false, "smart"));
    expect(out.results.length).toBe(MAX_SEARCH_RESULTS);
    expect(out.truncated).toBe(false);
  });
});

describe("oldSideRef", () => {
  it("maps each launch shape to its base", () => {
    expect(oldSideRef(["diff", "HEAD"], ".")).toBe("HEAD");
    expect(oldSideRef(["diff", "--staged"], ".")).toBe("HEAD");
    expect(oldSideRef(["diff", "main..feat"], ".")).toBe("main");
    expect(oldSideRef(["diff", "..feat"], ".")).toBe("HEAD");
    expect(oldSideRef(["diff", "abc123", "def456"], ".")).toBe("abc123");
    expect(oldSideRef([], ".")).toBeNull();
  });
});
