import { describe, expect, it } from "bun:test";
import { parseSuggestions, suggestionFence } from "../src/core/suggestions";
import { collectSuggestions } from "../src/core/suggestionPrompt";
import { compileReviewPrompt } from "../src/core/promptCompiler";
import { anchoredLines } from "../src/core/anchor";
import type { Comment, DiffFile, DiffLine, DiffResult, ReviewFile } from "../src/types";

const ln = (newLine: number, content: string, type: DiffLine["type"] = "context"): DiffLine =>
  ({ type, oldLine: type === "addition" ? null : newLine, newLine, content });
const lines = [ln(1, "one"), ln(2, "two", "addition"), ln(3, "three", "addition"), ln(4, "four")];
const file: DiffFile = { path: "a.ts", oldPath: null, changeType: "modified", additions: 2, deletions: 0, hunks: [{ header: "@@", lines }] };
const diff: DiffResult = { ref: "x", files: [file] };
const comment = (over: Partial<Comment>): Comment =>
  ({ id: "c1", file: "a.ts", line: 2, endLine: 3, lineContent: null, text: "", createdAt: "2026-06-01T00:00:00Z", ...over });
const review = (comments: Comment[]): ReviewFile =>
  ({ meta: { ref: "x", createdAt: "2026-06-01T00:00:00Z", updatedAt: "2026-06-02T00:00:00Z" }, viewed: [], comments });

describe("parseSuggestions", () => {
  it("returns prose only when there is no fence", () => {
    expect(parseSuggestions("just words")).toEqual([{ kind: "prose", text: "just words" }]);
  });

  it("splits several fences in order around prose", () => {
    const body = "first\n```suggestion\na\n```\nmiddle\n```suggestion\nb\nc\n```\nlast";
    expect(parseSuggestions(body)).toEqual([
      { kind: "prose", text: "first" },
      { kind: "suggestion", lines: ["a"] },
      { kind: "prose", text: "middle" },
      { kind: "suggestion", lines: ["b", "c"] },
      { kind: "prose", text: "last" },
    ]);
  });

  it("treats an empty fence as a delete, distinct from one blank line", () => {
    expect(parseSuggestions("```suggestion\n```")).toEqual([{ kind: "suggestion", lines: [] }]);
    expect(parseSuggestions("```suggestion\n\n```")).toEqual([{ kind: "suggestion", lines: [""] }]);
  });

  it("handles CRLF bodies", () => {
    expect(parseSuggestions("note\r\n```suggestion\r\nx\r\ny\r\n```\r\n")).toEqual([
      { kind: "prose", text: "note" },
      { kind: "suggestion", lines: ["x", "y"] },
    ]);
  });

  it("accepts info strings after the word suggestion and longer fences", () => {
    expect(parseSuggestions("```suggestion:-0+1\nx\n```")).toEqual([{ kind: "suggestion", lines: ["x"] }]);
    expect(parseSuggestions("````suggestion\n```\ninner\n```\n````")).toEqual([{ kind: "suggestion", lines: ["```", "inner", "```"] }]);
  });

  it("leaves other languages and unterminated fences as prose", () => {
    expect(parseSuggestions("```ts\ncode\n```")).toEqual([{ kind: "prose", text: "```ts\ncode\n```" }]);
    expect(parseSuggestions("hi\n```suggestion\nnever closed")).toEqual([{ kind: "prose", text: "hi\n```suggestion\nnever closed" }]);
  });

  it("round-trips through suggestionFence, widening the fence around backticks", () => {
    expect(parseSuggestions(suggestionFence(["a", "```"]))).toEqual([{ kind: "suggestion", lines: ["a", "```"] }]);
  });
});

describe("suggestions in the compiled prompt", () => {
  const body = "rename:\n```suggestion\nTWO\n```";

  it("expands a range comment into ORIGINAL and SUGGESTED blocks", () => {
    const out = compileReviewPrompt(diff, review([comment({ text: body })]));
    expect(out).toContain("Suggested change to a.ts, lines 2–3:");
    expect(out).toContain("ORIGINAL\n```\ntwo\nthree\n```");
    expect(out).toContain("SUGGESTED\n```\nTWO\n```");
    expect(out).not.toContain("```suggestion");
  });

  it("marks an empty suggestion as a delete", () => {
    const out = compileReviewPrompt(diff, review([comment({ text: "```suggestion\n```" })]));
    expect(out).toContain("SUGGESTED (delete these lines)");
  });

  it("keeps fences as written on file-level comments", () => {
    const out = compileReviewPrompt(diff, review([comment({ line: null, endLine: undefined, text: body })]));
    expect(out).toContain("```suggestion\nTWO\n```");
    expect(out).not.toContain("ORIGINAL");
  });
});

describe("collectSuggestions", () => {
  it("lists structured suggestions for open anchored line comments only", () => {
    const comments = [
      comment({ id: "a", text: "x\n```suggestion\nTWO\nTHREE\n```" }),
      comment({ id: "b", text: "```suggestion\nz\n```", status: "resolved" }),
      comment({ id: "c", line: null, text: "```suggestion\nz\n```" }),
      comment({ id: "d", line: 90, endLine: 90, text: "```suggestion\nz\n```" }),
    ];
    expect(collectSuggestions(diff, comments)).toEqual([
      { commentId: "a", path: "a.ts", side: "new", startLine: 2, endLine: 3, original: "two\nthree", suggested: "TWO\nTHREE" },
    ]);
  });

  it("reads the anchored lines per side", () => {
    expect(anchoredLines(file, "new", 1, 2)).toEqual(["one", "two"]);
    expect(anchoredLines(undefined, "new", 1, 2)).toEqual([]);
  });
});
