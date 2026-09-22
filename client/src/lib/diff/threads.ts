// pure helpers for the comment layer. every anchor is a (side, line) pair so old-side and
// new-side lines never collide. the ui store holds the live add/select state; these functions
// answer "is this line pending/in-range?" and build the comment to save.

import type { Comment, DiffLine } from "$types";

export type Side = "old" | "new";

export interface AddTarget {
  file: string;
  side?: Side;
  line: number | null; // null = a file-level comment
  endLine?: number;
}
export interface SelectTarget {
  file: string;
  side: Side;
  from: number;
  to: number;
}

const sideOf = (c: Comment): Side => c.side ?? "new";
const endOf = (c: Comment): number => (c.endLine != null ? c.endLine : (c.line as number));

// the raw diff line (marker + content) recorded on a comment anchor.
export function rawLine(line: DiffLine): string {
  const sign = line.type === "addition" ? "+" : line.type === "deletion" ? "-" : " ";
  return sign + line.content;
}

// stamp a fresh id + timestamp onto a new comment.
export function newComment(fields: Omit<Comment, "id" | "createdAt">): Comment {
  return { ...fields, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
}

// line comments anchored at (side, line); a thread renders once, below its END line.
export function commentsForLine(comments: Comment[], side: Side, line: number): Comment[] {
  return comments.filter((c) => c.line != null && sideOf(c) === side && endOf(c) === line);
}

export function fileComments(comments: Comment[]): Comment[] {
  return comments.filter((c) => c.line == null);
}

// (side, line) falls inside a saved comment's range — for the persistent range highlight.
export function inSavedRange(comments: Comment[], side: Side, line: number): boolean {
  return comments.some((c) => c.line != null && sideOf(c) === side && line >= (c.line as number) && line <= endOf(c));
}

// (side, line) inside the live drag-select or the open editor's pending range.
export function isPending(adding: AddTarget | null, selecting: SelectTarget | null, file: string, side: Side, line: number): boolean {
  if (selecting && selecting.file === file && selecting.side === side) {
    const lo = Math.min(selecting.from, selecting.to);
    const hi = Math.max(selecting.from, selecting.to);
    if (line >= lo && line <= hi) return true;
  }
  if (adding && adding.file === file && adding.line != null && (adding.side ?? "new") === side) {
    const hi = adding.endLine ?? adding.line;
    if (line >= adding.line && line <= hi) return true;
  }
  return false;
}

// the END line of the pending range on `side`, where the editor renders.
export function isAddingAt(adding: AddTarget | null, file: string, side: Side, line: number): boolean {
  return (
    adding != null &&
    adding.file === file &&
    adding.line != null &&
    (adding.side ?? "new") === side &&
    (adding.endLine ?? adding.line) === line
  );
}

// normalize the pending selection before it becomes a durable comment anchor.
export function selectedRange(adding: AddTarget | null, file: string, side: Side): { line: number; endLine: number } | null {
  if (!adding || adding.file !== file || adding.line == null || (adding.side ?? "new") !== side) return null;
  const other = adding.endLine ?? adding.line;
  return { line: Math.min(adding.line, other), endLine: Math.max(adding.line, other) };
}
