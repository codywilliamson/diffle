import { describe, it, expect } from "bun:test";
import { compileReviewPrompt } from "../src/core/promptCompiler";
import type { DiffResult, ReviewFile, Comment, DiffFile, DiffLine } from "../src/types";

const FX = "feature/x";

// builds a context/addition diff line with the given new-line number.
function ln(newLine: number, content: string, type: DiffLine["type"] = "context"): DiffLine {
  return { type, oldLine: type === "addition" ? null : newLine, newLine, content };
}

function file(path: string, lines: DiffLine[]): DiffFile {
  return {
    path,
    oldPath: null,
    changeType: "modified",
    additions: lines.filter((l) => l.type === "addition").length,
    deletions: 0,
    hunks: [{ header: "@@ -1,9 +1,9 @@", lines }],
  };
}

function comment(over: Partial<Comment>): Comment {
  return { id: "c1", file: "a.ts", line: 5, lineContent: null, text: "looks good", createdAt: "2026-06-01T00:00:00Z", ...over };
}

function review(comments: Comment[]): ReviewFile {
  return { meta: { ref: FX, createdAt: "2026-06-01T00:00:00Z", updatedAt: "2026-06-02T10:00:00Z" }, viewed: [], comments };
}

// a 9-line file so we can probe windows at the middle and at boundaries (line 7 is an addition).
const nineLines: DiffLine[] = [
  ln(1, "line one"), ln(2, "line two"), ln(3, "line three"), ln(4, "line four"), ln(5, "line five"),
  ln(6, "line six"), ln(7, "line seven", "addition"), ln(8, "line eight"), ln(9, "line nine"),
];

const baseDiff: DiffResult = { ref: FX, files: [file("a.ts", nineLines)] };

// runs the compiler against baseDiff (or an override) for the given comments.
function run(comments: Comment[], diff: DiffResult = baseDiff): string {
  return compileReviewPrompt(diff, review(comments));
}

describe("compileReviewPrompt", () => {
  it("renders the title with ref and the YYYY-MM-DD slice of updatedAt", () => {
    const out = run([comment({ line: 5 })]);
    expect(out).toContain("## Code Review — feature/x — 2026-06-02");
    expect(out).not.toContain("10:00:00");
  });

  it("includes exactly 2 lines above and below the commented line", () => {
    const out = run([comment({ line: 5 })]);
    expect(out).toContain("    3 | line three");
    expect(out).toContain("    4 | line four");
    expect(out).toContain("  > 5 |  line five");
    expect(out).toContain("    6 | line six");
    expect(out).toContain("    7 | line seven"); // addition shown as context in window
    expect(out).not.toContain("line two");
    expect(out).not.toContain("line eight");
  });

  it("clamps the window at the top boundary (fewer lines above)", () => {
    const out = run([comment({ line: 1 })]);
    expect(out).toContain("  > 1 |  line one");
    expect(out).toContain("    2 | line two");
    expect(out).toContain("    3 | line three");
    expect(out).not.toContain("line four");
  });

  it("clamps the window at the bottom boundary (fewer lines below)", () => {
    const out = run([comment({ line: 9 })]);
    expect(out).toContain("    7 | line seven");
    expect(out).toContain("    8 | line eight");
    expect(out).toContain("  > 9 |  line nine");
    expect(out).not.toContain("line six");
  });

  it("right-aligns line numbers to the widest number in the block", () => {
    expect(run([comment({ line: 8 })])).toContain("  > 8 |  line eight");
    const longLines: DiffLine[] = Array.from({ length: 12 }, (_, i) => ln(i + 1, `row ${i + 1}`));
    const out = run([comment({ line: 10 })], { ref: FX, files: [file("a.ts", longLines)] });
    // window 8..12 -> widest is 12 (width 2); 8 and 9 padded with a leading space.
    expect(out).toContain("     8 | row 8");
    expect(out).toContain("  > 10 |  row 10");
    expect(out).toContain("    12 | row 12");
  });

  it("fences the context block so the > markers render as code, not a markdown blockquote", () => {
    const out = run([comment({ line: 5 })]);
    const block = [
      "```",
      "    3 | line three",
      "    4 | line four",
      "  > 5 |  line five",
      "    6 | line six",
      "    7 | line seven",
      "```",
    ].join("\n");
    expect(out).toContain(block);
  });

  it("marks additions with + and context lines with no marker", () => {
    const out = run([comment({ line: 7 })]);
    expect(out).toContain("  > 7 | +line seven"); // commented addition gets > and the + marker
    expect(out).toContain("    5 | line five"); // surrounding context carries no visible marker
    expect(out).toContain("    6 | line six");
  });

  it("renders a file-level comment with no code block", () => {
    const out = run([comment({ line: null, text: "whole file note" })]);
    expect(out).toContain("### a.ts — File-level");
    expect(out).toContain("whole file note");
    expect(out).not.toContain(" | "); // no code line for this section
  });

  it("renders multiple comments on the same line in one block separated by a blank line", () => {
    const out = run([comment({ id: "c1", line: 5, text: "first note" }), comment({ id: "c2", line: 5, text: "second note" })]);
    expect(out.match(/  > 5 \|/g)?.length).toBe(1); // line 5 appears once
    expect(out.match(/### a\.ts — Line 5/g)?.length).toBe(1); // one section header
    expect(out).toContain("first note\n\nsecond note");
  });

  it("keeps comments on different lines as separate sections", () => {
    const out = run([comment({ id: "c1", line: 4 }), comment({ id: "c2", line: 6 })]);
    expect(out).toContain("### a.ts — Line 4");
    expect(out).toContain("### a.ts — Line 6");
  });

  it("renders a range with an en-dash header, ±2 context, and marks every line in [start, end]", () => {
    const out = run([comment({ line: 4, endLine: 6, text: "range note" })]);
    expect(out).toContain("### a.ts — Lines 4–6"); // en dash U+2013
    expect(out).toContain("    3 | line three"); // 2 above start (line 2 then 3)
    expect(out).toContain("  > 4 |  line four"); // range lines marked > (space marker for context)
    expect(out).toContain("  > 5 |  line five");
    expect(out).toContain("  > 6 |  line six");
    expect(out).toContain("    8 | line eight"); // 2 below end (line 7 then 8)
    expect(out).not.toContain("line one"); // 3 above start clamped out
    expect(out).not.toContain("line nine"); // 3 below end clamped out
    expect(out).toContain("range note");
  });

  it("treats endLine equal to line as a single line", () => {
    const out = run([comment({ line: 5, endLine: 5 })]);
    expect(out).toContain("### a.ts — Line 5");
    expect(out).not.toContain("Lines");
  });

  it("merges two comments on the same range into one section", () => {
    const out = run([comment({ id: "c1", line: 4, endLine: 6, text: "first" }), comment({ id: "c2", line: 4, endLine: 6, text: "second" })]);
    expect(out.match(/### a\.ts — Lines 4–6/g)?.length).toBe(1);
    expect(out.match(/  > 5 \|/g)?.length).toBe(1); // block rendered once
    expect(out).toContain("first\n\nsecond");
  });

  it("sorts a range and a single-line comment in the same file by start then end", () => {
    const out = run([comment({ id: "c1", line: 6 }), comment({ id: "c2", line: 4, endLine: 5 })]);
    expect(out.indexOf("### a.ts — Lines 4–5")).toBeLessThan(out.indexOf("### a.ts — Line 6"));
  });

  it("sorts files alphabetically in the output", () => {
    const diff: DiffResult = { ref: FX, files: [file("zebra.ts", nineLines), file("alpha.ts", nineLines)] };
    const out = run([comment({ id: "c1", file: "zebra.ts", line: 5 }), comment({ id: "c2", file: "alpha.ts", line: 5 })], diff);
    expect(out.indexOf("### alpha.ts")).toBeLessThan(out.indexOf("### zebra.ts"));
  });

  it("orders file-level comments before line comments within a file", () => {
    const out = run([comment({ id: "c1", line: 5 }), comment({ id: "c2", line: null, text: "fl" })]);
    expect(out.indexOf("File-level")).toBeLessThan(out.indexOf("Line 5"));
  });

  it("counts N comments across M distinct commented files in the summary", () => {
    const diff: DiffResult = { ref: FX, files: [file("a.ts", nineLines), file("b.ts", nineLines)] };
    const out = run([comment({ id: "c1", file: "a.ts", line: 4 }), comment({ id: "c2", file: "a.ts", line: 5 }), comment({ id: "c3", file: "b.ts", line: null })], diff);
    expect(out).toContain("## Summary: 3 comment(s) across 2 file(s)");
  });

  it("excludes a comment whose file is absent from the diff, leaving an empty summary", () => {
    const out = run([comment({ file: "ghost.ts", line: 5 })], { ref: FX, files: [] });
    expect(out).not.toContain("### ghost.ts");
    expect(out).toContain("## Summary: 0 comment(s) across 0 file(s)");
  });

  it("excludes a comment whose line is absent from the diff slice", () => {
    const out = run([comment({ line: 999 })]);
    expect(out).not.toContain("### a.ts — Line 999");
    expect(out).toContain("## Summary: 0 comment(s) across 0 file(s)");
  });

  it("produces an empty summary with zero comments", () => {
    const out = run([]);
    expect(out).toContain("## Summary: 0 comment(s) across 0 file(s)");
    expect(out).toContain("## Code Review — feature/x — 2026-06-02");
  });

  it("renders a mixed case of file-level and line comments across multiple files", () => {
    const diff: DiffResult = { ref: FX, files: [file("a.ts", nineLines), file("b.ts", nineLines)] };
    const out = run(
      [
        comment({ id: "c1", file: "b.ts", line: 3, text: "b line three" }),
        comment({ id: "c2", file: "a.ts", line: null, text: "a file note" }),
        comment({ id: "c3", file: "a.ts", line: 5, text: "a line five" }),
        comment({ id: "c4", file: "a.ts", line: 5, text: "a line five again" }),
      ], diff,
    );
    expect(out.indexOf("### a.ts — File-level")).toBeLessThan(out.indexOf("### a.ts — Line 5"));
    expect(out.indexOf("### a.ts — Line 5")).toBeLessThan(out.indexOf("### b.ts — Line 3"));
    expect(out).toContain("a line five\n\na line five again");
    expect(out).toContain("  > 3 | "); // b.ts code block present
    expect(out).toContain("## Summary: 4 comment(s) across 2 file(s)");
    expect(out).toContain("\n\n---\n\n"); // sections divided by the --- separator
  });

  it("renders an old-side comment with an 'Old line' header and removed-line context", () => {
    const lines: DiffLine[] = [
      { type: "context", oldLine: 1, newLine: 1, content: "keep one" },
      { type: "context", oldLine: 2, newLine: 2, content: "keep two" },
      { type: "deletion", oldLine: 3, newLine: null, content: "removed three" },
      { type: "context", oldLine: 4, newLine: 3, content: "keep four" },
    ];
    const diff: DiffResult = {
      ref: FX,
      files: [{ path: "a.ts", oldPath: null, changeType: "modified", additions: 0, deletions: 1, hunks: [{ header: "@@ -1,4 +1,3 @@", lines }] }],
    };
    const out = run([comment({ side: "old", line: 3, text: "why removed?" })], diff);
    expect(out).toContain("### a.ts — Old line 3");
    expect(out).toContain("  > 3 | -removed three"); // deletion marked with -
    expect(out).toContain("why removed?");
  });

  it("keeps old-side and new-side comments on the same number as separate sections (new first)", () => {
    const out = run([comment({ id: "c1", side: "new", line: 5, text: "new note" }), comment({ id: "c2", side: "old", line: 5, text: "old note" })]);
    expect(out).toContain("### a.ts — Line 5");
    expect(out).toContain("### a.ts — Old line 5");
    expect(out.indexOf("### a.ts — Line 5")).toBeLessThan(out.indexOf("### a.ts — Old line 5"));
  });

  it("excludes resolved comments from the prompt and the summary count", () => {
    const out = run([
      comment({ id: "c1", line: 4, text: "open note" }),
      comment({ id: "c2", line: 6, text: "resolved note", resolved: true }),
    ]);
    expect(out).toContain("### a.ts — Line 4");
    expect(out).toContain("open note");
    expect(out).not.toContain("### a.ts — Line 6");
    expect(out).not.toContain("resolved note");
    expect(out).toContain("## Summary: 1 comment(s) across 1 file(s)");
  });

  it("drops a file from the summary when all its comments are resolved", () => {
    const diff: DiffResult = { ref: FX, files: [file("a.ts", nineLines), file("b.ts", nineLines)] };
    const out = run(
      [
        comment({ id: "c1", file: "a.ts", line: 5, text: "keep me" }),
        comment({ id: "c2", file: "b.ts", line: 5, text: "done", resolved: true }),
      ], diff,
    );
    expect(out).toContain("### a.ts — Line 5");
    expect(out).not.toContain("### b.ts");
    expect(out).toContain("## Summary: 1 comment(s) across 1 file(s)");
  });

  it("excludes a comment whose file is no longer in the diff (orphaned)", () => {
    const out = run([
      comment({ id: "c1", file: "a.ts", line: 5, text: "kept note" }),
      comment({ id: "c2", file: "gone.ts", line: 5, text: "orphan file note" }),
    ]);
    expect(out).toContain("kept note");
    expect(out).not.toContain("### gone.ts");
    expect(out).not.toContain("orphan file note");
    expect(out).toContain("## Summary: 1 comment(s) across 1 file(s)");
  });

  it("excludes a comment whose line is no longer present in the diff (orphaned)", () => {
    const out = run([
      comment({ id: "c1", line: 5, text: "kept note" }),
      comment({ id: "c2", line: 999, text: "orphan line note" }),
    ]);
    expect(out).toContain("kept note");
    expect(out).not.toContain("orphan line note");
    expect(out).not.toContain("Line 999");
    expect(out).toContain("## Summary: 1 comment(s) across 1 file(s)");
  });

  it("keeps a range comment when any line in [line, endLine] still exists", () => {
    // lines 8-12: only 8 and 9 exist in the 9-line file -> still anchored, still rendered
    const out = run([comment({ line: 8, endLine: 12, text: "partial range note" })]);
    expect(out).toContain("partial range note");
    expect(out).toContain("## Summary: 1 comment(s) across 1 file(s)");
  });

  it("prefixes tagged comments with a bold [tag] and leaves untagged text bare", () => {
    const out = run([
      comment({ id: "c1", line: 5, tag: "nit", text: "rename this" }),
      comment({ id: "c2", line: 5, text: "plain note" }),
      comment({ id: "c3", line: null, tag: "praise", text: "clean module" }),
    ]);
    expect(out).toContain("**[nit]** rename this");
    expect(out).toContain("**[praise]** clean module");
    expect(out).toContain("plain note");
    expect(out).not.toContain("**[nit]** plain note");
  });

  it("appends a reply thread under its comment as an indented author: text list", () => {
    const out = run([
      comment({
        line: 5,
        text: "please explain",
        replies: [
          { id: "r1", author: "agent", text: "done, see the helper below", createdAt: "2026-06-01T00:01:00Z" },
          { id: "r2", author: "reviewer", text: "looks good now", createdAt: "2026-06-01T00:02:00Z" },
        ],
      }),
    ]);
    expect(out).toContain("please explain\n  - agent: done, see the helper below\n  - reviewer: looks good now");
  });

  it("omits the reply thread entirely when a comment has no replies", () => {
    const out = run([comment({ line: 5, text: "no replies here" })]);
    expect(out).not.toContain("  - agent:");
    expect(out).not.toContain("  - reviewer:");
  });

  it("indents continuation lines of a multiline reply under its bullet", () => {
    const out = run([
      comment({
        line: 5,
        text: "please explain",
        replies: [{ id: "r1", author: "reviewer", text: "first line\nsecond line", createdAt: "2026-06-01T00:01:00Z" }],
      }),
    ]);
    expect(out).toContain("  - reviewer: first line\n    second line");
  });

  it("excludes a status-only resolved comment and its replies from the prompt", () => {
    const out = run([
      comment({
        line: 5,
        status: "resolved",
        text: "fixed already",
        replies: [{ id: "r1", author: "agent", text: "done", createdAt: "2026-06-01T00:01:00Z" }],
      }),
    ]);
    expect(out).not.toContain("fixed already");
    expect(out).not.toContain("  - agent: done");
    expect(out).toContain("## Summary: 0 comment(s) across 0 file(s)");
  });

  it("includes a Reviewer summary section positioned before file sections", () => {
    const out = compileReviewPrompt(baseDiff, review([comment({ line: 5 })]), "Tighten the error path.");
    expect(out).toContain("## Reviewer summary\n\nTighten the error path.");
    expect(out.indexOf("## Reviewer summary")).toBeLessThan(out.indexOf("### a.ts — Line 5"));
  });

  it("compiles a useful summary-only prompt with zero comments", () => {
    const out = compileReviewPrompt(baseDiff, review([]), "Looks fine overall.");
    expect(out).toContain("## Code Review — feature/x — 2026-06-02");
    expect(out).toContain("## Reviewer summary\n\nLooks fine overall.");
    expect(out).toContain("## Summary: 0 comment(s) across 0 file(s)");
  });

  it("omits the Reviewer summary section when no summary is given", () => {
    const out = run([comment({ line: 5 })]);
    expect(out).not.toContain("Reviewer summary");
  });

  it("trims a whitespace-only summary to omit the section", () => {
    const out = compileReviewPrompt(baseDiff, review([comment({ line: 5 })]), "   ");
    expect(out).not.toContain("Reviewer summary");
  });
});
