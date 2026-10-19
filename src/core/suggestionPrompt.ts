// server side of suggestion blocks: expands them in the compiled prompt and lists them as
// structured data (get_review). only line and range comments carry them; file-level fences
// stay exactly as written, and so do fences on a range that crosses lines outside the diff.

import type { Comment, DiffFile, DiffResult, ReviewSuggestion } from "../types";
import { SPAN_GAP_MESSAGE, contiguousLines, isAnchored, isOpenComment, rangeEnd, sideOf, type Side } from "./anchor";
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
  const original = contiguousLines(file, range.side, range.start, range.end);
  const segments = parseSuggestions(text);
  if (!original) {
    if (!segments.some((segment) => segment.kind === "suggestion")) return text;
    return `${text}\n\n(Suggestion not expanded: ${SPAN_GAP_MESSAGE}.)`;
  }
  return segments
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

export interface CollectedSuggestions { suggestions: ReviewSuggestion[]; errors: string[] }

// every suggestion in the open, anchored line comments, in comment order; ranges that cross
// lines outside the diff are reported in `errors` instead of being listed with partial text
export function collectSuggestions(diff: DiffResult, comments: Comment[]): CollectedSuggestions {
  const out: CollectedSuggestions = { suggestions: [], errors: [] };
  for (const c of comments) {
    if (c.line === null || !isOpenComment(c) || !isAnchored(c, diff)) continue;
    const side = sideOf(c);
    const end = rangeEnd(c);
    const blocks = parseSuggestions(c.text).filter((segment) => segment.kind === "suggestion");
    if (blocks.length === 0) continue;
    const original = contiguousLines(diff.files.find((f) => f.path === c.file), side, c.line, end);
    if (!original) {
      out.errors.push(`comment ${c.id} (${c.file} ${c.line}-${end}): ${SPAN_GAP_MESSAGE}`);
      continue;
    }
    for (const block of blocks) {
      out.suggestions.push({ commentId: c.id, path: c.file, side, startLine: c.line, endLine: end, original, suggested: block.lines });
    }
  }
  return out;
}
