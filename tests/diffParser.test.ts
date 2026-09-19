import { describe, it, expect } from "bun:test";
import { parseDiff } from "../src/core/diffParser";
import type { DiffFile } from "../src/types";

const raw = await Bun.file(new URL("./fixtures/sample.diff", import.meta.url)).text();
const result = parseDiff(raw, "working tree");
const byPath = (p: string): DiffFile => {
  const f = result.files.find((file) => file.path === p);
  if (!f) throw new Error(`no file for ${p}`);
  return f;
};

describe("parseDiff", () => {
  it("places the ref label verbatim in the result", () => {
    expect(result.ref).toBe("working tree");
  });

  it("returns an empty files array for blank input", () => {
    expect(parseDiff("", "ref")).toEqual({ ref: "ref", files: [] });
    expect(parseDiff("   \n\t\n", "ref")).toEqual({ ref: "ref", files: [] });
  });

  it("parses every file section in the fixture", () => {
    expect(result.files.length).toBe(7);
  });

  it("classifies an added file with a /dev/null old side", () => {
    const f = byPath("src/added.ts");
    expect(f.changeType).toBe("added");
    expect(f.oldPath).toBeNull();
    expect(f.additions).toBe(3);
    expect(f.deletions).toBe(0);
    expect(f.binary).toBeUndefined();
  });

  it("tracks null oldLine and incrementing newLine on additions", () => {
    const lines = byPath("src/added.ts").hunks[0]!.lines;
    expect(lines.map((l) => l.type)).toEqual(["addition", "addition", "addition"]);
    expect(lines[0]).toEqual({ type: "addition", oldLine: null, newLine: 1, content: "export const a = 1;" });
    expect(lines[2]!.newLine).toBe(3);
  });

  it("classifies a deleted file", () => {
    const f = byPath("src/deleted.ts");
    expect(f.changeType).toBe("deleted");
    expect(f.additions).toBe(0);
    expect(f.deletions).toBe(2);
    const lines = f.hunks[0]!.lines;
    expect(lines[0]).toEqual({ type: "deletion", oldLine: 1, newLine: null, content: "const gone = true;" });
    expect(lines[1]!.oldLine).toBe(2);
  });

  it("classifies a modified file and counts additions/deletions across hunks", () => {
    const f = byPath("src/modified.ts");
    expect(f.changeType).toBe("modified");
    expect(f.oldPath).toBeNull();
    expect(f.additions).toBe(3);
    expect(f.deletions).toBe(2);
    expect(f.hunks.length).toBe(2);
  });

  it("strips the section heading from hunk headers", () => {
    const f = byPath("src/modified.ts");
    expect(f.hunks[0]!.header).toBe("@@ -1,4 +1,4 @@");
    expect(f.hunks[1]!.header).toBe("@@ -38,7 +38,9 @@");
    expect(f.hunks[1]!.section).toBe("function tail() {");
  });

  it("tracks old/new line numbers correctly across multiple hunks", () => {
    const h = byPath("src/modified.ts").hunks;
    // first hunk starts at 1/1
    expect(h[0]!.lines[0]).toEqual({ type: "context", oldLine: 1, newLine: 1, content: "line one" });
    expect(h[0]!.lines[1]).toEqual({ type: "deletion", oldLine: 2, newLine: null, content: "line two old" });
    expect(h[0]!.lines[2]).toEqual({ type: "addition", oldLine: null, newLine: 2, content: "line two new" });
    expect(h[0]!.lines[3]).toEqual({ type: "context", oldLine: 3, newLine: 3, content: "line three" });
    // second hunk resumes at 38/38, independent of the first
    const second = h[1]!.lines;
    expect(second[0]).toEqual({ type: "context", oldLine: 38, newLine: 38, content: "keep a" });
    const removed = second.find((l) => l.content === "removed mid")!;
    expect(removed).toEqual({ type: "deletion", oldLine: 40, newLine: null, content: "removed mid" });
    const lastContext = second[second.length - 1]!;
    expect(lastContext).toEqual({ type: "context", oldLine: 43, newLine: 44, content: "keep e" });
  });

  it("classifies a renamed file with a content hunk and records oldPath", () => {
    const f = byPath("src/new-name.ts");
    expect(f.changeType).toBe("renamed");
    expect(f.oldPath).toBe("src/old-name.ts");
    expect(f.additions).toBe(1);
    expect(f.deletions).toBe(1);
    expect(f.hunks.length).toBe(1);
  });

  it("classifies a pure rename with no content hunk", () => {
    const f = byPath("src/renamed-pure.ts");
    expect(f.changeType).toBe("renamed");
    expect(f.oldPath).toBe("src/pure-rename.ts");
    expect(f.additions).toBe(0);
    expect(f.deletions).toBe(0);
    expect(f.hunks).toEqual([]);
  });

  it("flags a binary file with empty hunks and zero counts", () => {
    const f = byPath("assets/logo.png");
    expect(f.binary).toBe(true);
    expect(f.changeType).toBe("added");
    expect(f.hunks).toEqual([]);
    expect(f.additions).toBe(0);
    expect(f.deletions).toBe(0);
  });

  it("skips 'no newline at end of file' markers without counting them", () => {
    const f = byPath("src/no-newline.ts");
    expect(f.additions).toBe(1);
    expect(f.deletions).toBe(1);
    expect(f.hunks[0]!.lines).toEqual([
      { type: "deletion", oldLine: 1, newLine: null, content: "before" },
      { type: "addition", oldLine: null, newLine: 1, content: "after" },
    ]);
  });

  it("treats an omitted hunk count as 1", () => {
    const single = parseDiff(
      ["diff --git a/x.ts b/x.ts", "index 1..2 100644", "--- a/x.ts", "+++ b/x.ts", "@@ -1 +1 @@", "-a", "+b"].join("\n"),
      "r",
    );
    expect(single.files[0]!.hunks[0]!.header).toBe("@@ -1 +1 @@");
    expect(single.files[0]!.hunks[0]!.lines[0]!.oldLine).toBe(1);
    expect(single.files[0]!.hunks[0]!.lines[1]!.newLine).toBe(1);
  });
});
