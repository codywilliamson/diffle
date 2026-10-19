import { describe, expect, it } from "vitest";
import type { DiffFile } from "$types";
import { buildIndex } from "./cursorSteps";
import { findHitStop, resolveHitFile } from "./cursorHit";

const file = (path: string, oldPath: string | null): DiffFile => ({
  path,
  oldPath,
  changeType: oldPath ? "renamed" : "modified",
  additions: 0,
  deletions: 0,
  hunks: [{ header: "@@", lines: [
    { type: "context", oldLine: 1, newLine: 1, content: "a" },
    { type: "deletion", oldLine: 2, newLine: null, content: "b" },
    { type: "addition", oldLine: null, newLine: 2, content: "c" },
    { type: "context", oldLine: 10, newLine: 10, content: "d" },
  ] }],
});

describe("resolveHitFile", () => {
  const files = [file("new.ts", "old.ts"), file("same.ts", null)];
  it("matches old-side hits by the old path and new-side hits by the new path", () => {
    expect(resolveHitFile(files, { path: "old.ts", side: "old" })?.path).toBe("new.ts");
    expect(resolveHitFile(files, { path: "new.ts", side: "new" })?.path).toBe("new.ts");
    expect(resolveHitFile(files, { path: "old.ts", side: "new" })).toBeUndefined();
    expect(resolveHitFile(files, { path: "same.ts", side: "old" })?.path).toBe("same.ts");
  });
});

describe("findHitStop", () => {
  const f = file("a.ts", null);
  const index = (split: boolean) => buildIndex([{ file: f, split, navigable: true }], "new");
  it("finds the exact line on the hit's side", () => {
    expect(findHitStop(index(false), "a.ts", "old", 2, false)).toMatchObject({ oldLine: 2, newLine: null });
    expect(findHitStop(index(false), "a.ts", "new", 2, false)).toMatchObject({ oldLine: null, newLine: 2 });
  });
  it("falls back to the nearest line when the hit is outside the hunks", () => {
    expect(findHitStop(index(false), "a.ts", "new", 8, false)).toMatchObject({ newLine: 10 });
  });
  it("only uses the pane's own side in split view", () => {
    expect(findHitStop(index(true), "a.ts", "new", 10, true)).toMatchObject({ side: "new", line: 10 });
  });
  it("returns null for an unknown file", () => {
    expect(findHitStop(index(false), "zzz", "new", 1, false)).toBeNull();
  });
});
