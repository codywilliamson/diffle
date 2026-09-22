import { describe, expect, it } from "vitest";
import type { ChangeType, DiffFile } from "$types";
import {
  canOverrideFileSplit,
  canPreviewMarkdown,
  createFileSplitState,
  resolveFileSplit,
  syncGlobalSplit,
  toggleFileSplit,
} from "./fileMode";

function file(changeType: ChangeType, path = "README.md", binary = false): DiffFile {
  return { path, oldPath: null, changeType, additions: 1, deletions: 1, binary, hunks: [] };
}

describe("file presentation modes", () => {
  it("does not offer a rendered preview for deleted or binary Markdown", () => {
    expect(canPreviewMarkdown(file("deleted"))).toBe(false);
    expect(canPreviewMarkdown(file("modified", "README.md", true))).toBe(false);
    expect(canPreviewMarkdown(file("added"))).toBe(true);
    expect(canPreviewMarkdown(file("modified"))).toBe(true);
    expect(canPreviewMarkdown(file("renamed"))).toBe(true);
  });

  it("keeps each file override isolated and stable across refreshed file data", () => {
    const first = toggleFileSplit(createFileSplitState(false), file("modified", "first.ts"), "diff");
    const second = createFileSplitState(false);

    expect(resolveFileSplit(first, file("modified", "first.ts"), "diff")).toBe(true);
    expect(resolveFileSplit(second, file("modified", "second.ts"), "diff")).toBe(false);
  });

  it("clears an override when the global preference changes", () => {
    const overridden = toggleFileSplit(createFileSplitState(false), file("modified"), "diff");
    const reset = syncGlobalSplit(overridden, true);

    expect(reset).toEqual({ global: true, override: null });
    expect(resolveFileSplit(reset, file("modified"), "diff")).toBe(true);
  });

  it.each(["added", "deleted"] as const)("forces %s files to unified mode", (changeType) => {
    const source = createFileSplitState(true);
    expect(canOverrideFileSplit(file(changeType), "diff")).toBe(false);
    expect(resolveFileSplit(source, file(changeType), "diff")).toBe(false);
    expect(toggleFileSplit(source, file(changeType), "diff")).toBe(source);
  });

  it("forces browse mode to unified and disables its local override", () => {
    const source = createFileSplitState(true);
    expect(canOverrideFileSplit(file("modified"), "browse")).toBe(false);
    expect(resolveFileSplit(source, file("modified"), "browse")).toBe(false);
  });
});
