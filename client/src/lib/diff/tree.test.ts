import { describe, it, expect } from "vitest";
import type { DiffFile } from "$types";
import { buildTree, fileAnchorId } from "./tree";

function file(path: string): DiffFile {
  return { path, oldPath: null, changeType: "modified", additions: 0, deletions: 0, hunks: [] };
}

describe("buildTree", () => {
  it("nests files under their directory segments", () => {
    const root = buildTree([file("src/a.ts"), file("src/core/b.ts"), file("readme.md")]);
    expect(root.files.map((f) => f.name)).toEqual(["readme.md"]);
    const src = root.dirs.get("src")!;
    expect(src.path).toBe("src");
    expect(src.files.map((f) => f.name)).toEqual(["a.ts"]);
    const core = src.dirs.get("core")!;
    expect(core.path).toBe("src/core");
    expect(core.files.map((f) => f.name)).toEqual(["b.ts"]);
  });

  it("keeps the original file fields and adds a leaf name", () => {
    const root = buildTree([{ ...file("x/y.ts"), additions: 3 }]);
    const leaf = root.dirs.get("x")!.files[0]!;
    expect(leaf.name).toBe("y.ts");
    expect(leaf.path).toBe("x/y.ts");
    expect(leaf.additions).toBe(3);
  });
});

describe("fileAnchorId", () => {
  it("produces a dom-safe id", () => {
    expect(fileAnchorId("src/a b.ts")).toBe("file-src-a-b-ts");
  });
});
