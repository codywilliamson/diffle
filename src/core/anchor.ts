// staleness: is a comment still anchored to a line/file present in the current diff?
// orphaned comments (anchor gone) are excluded from the compiled prompt and surfaced
// for cleanup in the ui. the svelte client imports this module directly (via $lib/anchor).

import type { Comment, DiffResult, DiffLine, DiffFile } from "../types";

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

// a comment is anchored if its file is in the diff and (for line comments) some hunk line
// on its side still carries a number within [line, endLine]. a range counts as anchored
// when ANY line in it survives. file-level comments are anchored iff the file is present.
export function isAnchored(comment: Comment, diff: DiffResult): boolean {
  const file = diff.files.find((f) => f.path === comment.file);
  if (!file) return false;
  if (comment.line == null) return true;
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

// the text of the diff lines numbered within [start, end] on `side`, in file order.
// new side = additions + context (what the file will contain), old side = deletions + context.
export function anchoredLines(file: DiffFile | undefined, side: Side, start: number, end: number): string[] {
  if (!file) return [];
  return file.hunks
    .flatMap((h) => h.lines)
    .filter((l) => {
      const n = numOn(l, side);
      return n != null && n >= start && n <= end;
    })
    .map((l) => l.content);
}

export const SPAN_GAP_MESSAGE = "this range spans unchanged lines that are not in the diff, so it cannot carry a suggestion; comment on lines inside one hunk";

// the anchored lines when every number in [start, end] is present in the diff on `side`;
// null when the range crosses lines between hunks (their text is not in the diff).
export function contiguousLines(file: DiffFile | undefined, side: Side, start: number, end: number): string[] | null {
  const lines = anchoredLines(file, side, start, end);
  return lines.length === end - start + 1 ? lines : null;
}

// resolved comments stay in the file for the record; status is the source of truth, falling
// back to the legacy `resolved` flag for records that predate it.
export function isOpenComment(c: Comment): boolean {
  return (c.status ?? (c.resolved ? "resolved" : "open")) !== "resolved";
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
