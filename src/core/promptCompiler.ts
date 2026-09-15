import type { DiffResult, ReviewFile, Comment, DiffFile, DiffLine } from "../types";
import { type Side, sideOf, numOn, rangeEnd, isAnchored } from "./anchor";

// assembles inline review comments + their diff context into a markdown prompt.
// pure: all header values derive from inputs, no clock access.

const DIVIDER = "\n\n---\n\n";

// lines that carry a number on `side`: new = additions + context, old = deletions + context.
function lineSlice(file: DiffFile, side: Side): DiffLine[] {
  return file.hunks.flatMap((h) => h.lines).filter((l) => numOn(l, side) !== null);
}

function markerFor(line: DiffLine): string {
  if (line.type === "addition") return "+";
  if (line.type === "deletion") return "-";
  return " ";
}

// builds the fenced context block around the commented range on `side`.
// window is 2 lines above `start` and 2 below `end`, clamped at file boundaries.
// every line whose number is in [start, end] is marked with `> `; others are context.
// the block is fenced so the `> ` markers render as code, not a markdown blockquote.
function buildContextBlock(file: DiffFile, side: Side, start: number, end: number): string {
  const slice = lineSlice(file, side);
  const startIdx = slice.findIndex((l) => numOn(l, side) === start);
  const endIdx = slice.findIndex((l) => numOn(l, side) === end);
  if (startIdx === -1 || endIdx === -1) return "";

  const from = Math.max(0, startIdx - 2);
  const to = Math.min(slice.length - 1, endIdx + 2);
  const window = slice.slice(from, to + 1);

  const width = Math.max(...window.map((l) => String(numOn(l, side)).length));
  const lines = window
    .map((l) => {
      const n = numOn(l, side) as number;
      const num = String(n).padStart(width, " ");
      const inRange = n >= start && n <= end;
      if (inRange) return `  > ${num} | ${markerFor(l)}${l.content}`;
      return `    ${num} | ${l.content}`;
    })
    .join("\n");
  return `\`\`\`\n${lines}\n\`\`\``;
}

// a comment's reply thread as an indented "author: text" list, in stored order.
// empty when there are no replies, so untouched comments render exactly as before.
// continuation lines of a multiline reply are indented under the bullet so the nested list survives.
function replyThread(comment: Comment): string {
  if (!comment.replies?.length) return "";
  const lines = comment.replies.map((r) => `  - ${r.author}: ${r.text.replace(/\n/g, "\n    ")}`).join("\n");
  return `\n${lines}`;
}

// joins multiple comment texts on one target with a blank line between them;
// tagged comments get a bold [tag] prefix so the llm sees the reviewer's intent.
function joinTexts(comments: Comment[]): string {
  return comments.map((c) => `${c.tag ? `**[${c.tag}]** ${c.text}` : c.text}${replyThread(c)}`).join("\n\n");
}

function fileLevelSection(file: string, comments: Comment[]): string {
  // file-level: header then the comment text directly, no code block.
  return `### ${file} — File-level\n\n${joinTexts(comments)}`;
}

function lineSection(file: string, diffFile: DiffFile | undefined, side: Side, start: number, end: number, comments: Comment[]): string {
  // new side uses "Line n" / "Lines a–b"; old side prefixes with "Old" for removed lines.
  const one = side === "old" ? "Old line" : "Line";
  const many = side === "old" ? "Old lines" : "Lines";
  const header = start === end ? `### ${file} — ${one} ${start}` : `### ${file} — ${many} ${start}–${end}`;
  const block = diffFile ? buildContextBlock(diffFile, side, start, end) : "";
  // comments sharing the exact side+range share one block; different ranges are separate sections.
  return `${header}\n\n${block}\n\n${joinTexts(comments)}`;
}

// groups a file's comments into ordered sections: file-level first, then by range
// (start asc, end asc, new side before old). same side+start+end merge into one section.
function sectionsForFile(file: string, diffFile: DiffFile | undefined, comments: Comment[]): string[] {
  const out: string[] = [];

  const fileLevel = comments.filter((c) => c.line === null);
  if (fileLevel.length > 0) out.push(fileLevelSection(file, fileLevel));

  const byRange = new Map<string, { side: Side; start: number; end: number; comments: Comment[] }>();
  for (const c of comments) {
    if (c.line === null) continue;
    const side = sideOf(c);
    const start = c.line;
    const end = rangeEnd(c);
    const key = `${side}:${start}:${end}`;
    const bucket = byRange.get(key) ?? { side, start, end, comments: [] };
    bucket.comments.push(c);
    byRange.set(key, bucket);
  }

  const sideRank = (s: Side) => (s === "new" ? 0 : 1);
  const ranges = [...byRange.values()].sort(
    (a, b) => a.start - b.start || a.end - b.end || sideRank(a.side) - sideRank(b.side)
  );
  for (const r of ranges) {
    out.push(lineSection(file, diffFile, r.side, r.start, r.end, r.comments));
  }
  return out;
}

export function compileReviewPrompt(diff: DiffResult, review: ReviewFile, summary?: string): string {
  const ref = review.meta.ref;
  const date = review.meta.updatedAt.slice(0, 10);
  const title = `## Code Review — ${ref} — ${date}`;

  // resolved comments stay in the file for the record; orphaned comments (anchor no longer
  // in the diff) are managed in the ui. both are left out of the prompt. status is the source
  // of truth, falling back to the legacy `resolved` flag for records that predate it.
  const open = review.comments.filter(
    (c) => (c.status ?? (c.resolved ? "resolved" : "open")) !== "resolved" && isAnchored(c, diff)
  );

  const byFile = new Map<string, Comment[]>();
  for (const c of open) {
    const bucket = byFile.get(c.file) ?? [];
    bucket.push(c);
    byFile.set(c.file, bucket);
  }

  const diffByPath = new Map(diff.files.map((f) => [f.path, f]));

  const sections: string[] = [];
  for (const file of [...byFile.keys()].sort()) {
    sections.push(...sectionsForFile(file, diffByPath.get(file), byFile.get(file) ?? []));
  }

  const total = open.length;
  const fileCount = byFile.size;
  const summaryLine = `## Summary: ${total} comment(s) across ${fileCount} file(s)`;

  const trimmedSummary = summary?.trim();
  const summarySection = trimmedSummary ? `## Reviewer summary\n\n${trimmedSummary}${DIVIDER}` : "";

  const body = sections.length > 0 ? sections.join(DIVIDER) + DIVIDER : "";
  return `${title}${DIVIDER}${summarySection}${body}${summaryLine}`;
}
