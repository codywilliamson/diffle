import { describe, it, expect } from "vitest";
import type { DiffFile, DiffLine } from "$types";
import { highlightFile, needsFileText } from "./highlight";

const KEYWORD = "var(--syn-keyword)";

const ctx = (oldLine: number, newLine: number, content: string): DiffLine => ({ type: "context", oldLine, newLine, content });
const add = (newLine: number, content: string): DiffLine => ({ type: "addition", oldLine: null, newLine, content });
const del = (oldLine: number, content: string): DiffLine => ({ type: "deletion", oldLine, newLine: null, content });

function file(path: string, lines: DiffLine[], changeType: DiffFile["changeType"] = "modified", header = "@@ -3,2 +3,2 @@"): DiffFile {
  return { path, oldPath: null, changeType, additions: 0, deletions: 0, hunks: [{ header, lines }] };
}

// a svelte hunk that starts inside <script>, two lines below the tag.
const SVELTE_TEXT = ['<script lang="ts">', "  import x from './x';", "  let count = $state(0);", "</script>", "<p>{count}</p>"].join("\n");
const svelteHunk = () => [ctx(3, 3, "  let count = $state(0);"), ctx(4, 4, "</script>")];

describe("highlightFile", () => {
  it("seeds a mid-file hunk with the file's context so embedded script highlights", async () => {
    const f = file("App.svelte", svelteHunk());
    const html = await highlightFile(f, SVELTE_TEXT);
    expect(html.get(f.hunks[0]!.lines[0]!)).toContain(KEYWORD);
    // without the file text the same line reads as markup text
    const bare = await highlightFile(f, null);
    expect(bare.get(f.hunks[0]!.lines[0]!)).not.toContain(KEYWORD);
  });

  it("highlights old-side deletions and new-side additions separately", async () => {
    const lines = [ctx(1, 1, "const a = 1;"), del(2, "let b = 'old';"), add(2, "let b = 'new';")];
    const f = file("a.ts", lines, "modified", "@@ -1,2 +1,2 @@");
    const html = await highlightFile(f, null);
    expect(html.get(lines[1]!)).toContain("old");
    expect(html.get(lines[2]!)).toContain("new");
    expect(html.get(lines[0]!)).toContain(KEYWORD);
  });

  it("escapes markup inside tokens", async () => {
    const line = add(1, "const s = '<b>&';");
    const html = await highlightFile(file("a.ts", [line], "added", "@@ -0,0 +1 @@"), null);
    expect(html.get(line)).toContain("&lt;b&gt;&amp;");
    expect(html.get(line)).not.toContain("<b>");
  });

  it("returns nothing for files without a grammar", async () => {
    const html = await highlightFile(file("notes.unknownext", [add(1, "hello")], "added"), null);
    expect(html.size).toBe(0);
  });
});

describe("needsFileText", () => {
  it("wants the file text only for modified files with mid-file hunks", () => {
    expect(needsFileText(file("App.svelte", svelteHunk()))).toBe(true);
    expect(needsFileText(file("a.ts", [add(1, "x")], "added"))).toBe(false);
    expect(needsFileText(file("a.ts", [ctx(1, 1, "x")]))).toBe(false);
  });

  it("reads a pure-deletion hunk's position from its header", () => {
    expect(needsFileText(file("a.ts", [del(5, "x")], "modified", "@@ -5 +4,0 @@"))).toBe(true);
  });
});
