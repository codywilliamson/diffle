// finds hunks whose only change is whitespace (reindent, line rewrap, trailing space).

import type { DiffFile, DiffHunk, LineType } from "../../types";

const ANY_WHITESPACE = /\s+/;

export function countChangedLines(hunk: DiffHunk): number {
  return hunk.lines.filter((l) => l.type !== "context").length;
}

// whitespace-separated tokens of one side, so `foo bar` -> `foobar` still counts as a real change
function tokens(hunk: DiffHunk, type: LineType): string[] {
  return hunk.lines
    .filter((l) => l.type === type)
    .flatMap((l) => l.content.split(ANY_WHITESPACE))
    .filter(Boolean);
}

const sameTokens = (a: string[], b: string[]): boolean => a.length === b.length && a.every((t, i) => t === b[i]);

// indices into file.hunks. binary files have no hunks, so they yield [].
export function whitespaceOnlyHunks(file: DiffFile): number[] {
  const indices: number[] = [];
  file.hunks.forEach((hunk, index) => {
    if (countChangedLines(hunk) === 0) return;
    if (sameTokens(tokens(hunk, "deletion"), tokens(hunk, "addition"))) indices.push(index);
  });
  return indices;
}
