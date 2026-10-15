// staleness: is a comment still anchored to a line/file present in the current diff?
// orphaned comments (anchor gone) are excluded from the compiled prompt and surfaced
// for cleanup in the ui. the svelte client imports this module directly (via $lib/anchor).

import type { Comment, DiffResult, DiffLine } from "../types";

export type Side = "old" | "new";

export const sideOf = (c: Comment): Side => c.side ?? "new";

// the line's number on the given side (deletions lack a new number, additions an old one).
export function numOn(line: DiffLine, side: Side): number | null {
  return side === "old" ? line.oldLine : line.newLine;
}

// inclusive end of a comment's range; single-line when endLine is absent/null.
export function rangeEnd(c: Comment): number {
  return c.endLine != null ? Math.max(c.line as number, c.endLine) : (c.line as number);
}

// a new-side comment written on an unchanged line (its recorded line carries the context
// marker). it may sit on context the reader expanded, outside every hunk.
const CONTEXT_MARKER = " ";
const onUnchangedLine = (c: Comment): boolean => sideOf(c) === "new" && c.lineContent?.startsWith(CONTEXT_MARKER) === true;

// a comment is anchored if its file is in the diff and (for line comments) some hunk line
// on its side still carries a number within [line, endLine]. a range counts as anchored
// when ANY line in it survives. file-level comments are anchored iff the file is present;
// comments on unchanged lines (which expanded context can show anywhere in the file) also
// need their range inside the file's known line count.
export function isAnchored(comment: Comment, diff: DiffResult): boolean {
  const file = diff.files.find((f) => f.path === comment.file);
  if (!file) return false;
  if (comment.line == null) return true;
  if (onUnchangedLine(comment)) return file.lineCount == null || rangeEnd(comment) <= file.lineCount;
  const side = sideOf(comment);
  const start = comment.line;
  const end = rangeEnd(comment);
  return file.hunks.some((h) =>
    h.lines.some((l) => {
      const n = numOn(l, side);
      return n != null && n >= start && n <= end;
    })
  );
}

export interface PartitionedComments {
  anchored: Comment[];
  stale: Comment[];
}

// splits comments into those still anchored in the diff and those orphaned, preserving order.
export function partitionComments(comments: Comment[], diff: DiffResult): PartitionedComments {
  const anchored: Comment[] = [];
  const stale: Comment[] = [];
  for (const c of comments) (isAnchored(c, diff) ? anchored : stale).push(c);
  return { anchored, stale };
}
