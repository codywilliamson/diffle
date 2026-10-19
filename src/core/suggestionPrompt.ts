// server side of suggestion blocks: expands them in the compiled prompt and lists them as
// structured data (get_review). only line and range comments carry them; file-level fences
// stay exactly as written.

import type { Comment, DiffFile, DiffResult, ReviewSuggestion } from "../types";
import { anchoredLines, isAnchored, isOpenComment, rangeEnd, sideOf, type Side } from "./anchor";
import { fenceFor, parseSuggestions } from "./suggestions";

export interface LineRange { path: string; side: Side; start: number; end: number }

function fenced(lines: string[]): string {
  const fence = fenceFor(lines);
  return [fence, ...lines, fence].join("\n");
}

function rangeLabel(range: LineRange): string {
  const noun = range.side === "old" ? "old line" : "line";
  return range.start === range.end ? `${noun} ${range.start}` : `${noun}s ${range.start}–${range.end}`;
}

// comment text with each suggestion fence replaced by ORIGINAL and SUGGESTED blocks
export function expandSuggestions(text: string, range: LineRange, file: DiffFile | undefined): string {
  const original = anchoredLines(file, range.side, range.start, range.end);
  return parseSuggestions(text)
    .map((segment) => {
      if (segment.kind === "prose") return segment.text;
      const note = segment.lines.length === 0 ? " (delete these lines)" : "";
      return [
        `Suggested change to ${range.path}, ${rangeLabel(range)}:`,
        `ORIGINAL\n${fenced(original)}`,
        `SUGGESTED${note}\n${fenced(segment.lines)}`,
      ].join("\n\n");
    })
    .join("\n\n");
}

// every suggestion in the open, anchored line comments, in comment order
export function collectSuggestions(diff: DiffResult, comments: Comment[]): ReviewSuggestion[] {
  const out: ReviewSuggestion[] = [];
  for (const c of comments) {
    if (c.line === null || !isOpenComment(c) || !isAnchored(c, diff)) continue;
    const side = sideOf(c);
    const end = rangeEnd(c);
    const file = diff.files.find((f) => f.path === c.file);
    const original = anchoredLines(file, side, c.line, end).join("\n");
    for (const segment of parseSuggestions(c.text)) {
      if (segment.kind !== "suggestion") continue;
      out.push({ commentId: c.id, path: c.file, side, startLine: c.line, endLine: end, original, suggested: segment.lines.join("\n") });
    }
  }
  return out;
}
