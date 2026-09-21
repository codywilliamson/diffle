import type { DiffFile } from "$types";

// diff rows render at ~13px * 1.5 line-height; used to size lazy placeholders.
export const ROW_HEIGHT = 19;
// files bigger than this are hidden behind a manual "Load diff" gate.
export const GIANT_FILE_LINES = 2000;

export function lineCountOf(file: DiffFile): number {
  let n = 0;
  for (const hunk of file.hunks) n += hunk.lines.length;
  return n;
}

// placeholder height for an unmounted file body: one row per line + one per hunk header.
export function estimatedHeight(file: DiffFile): number {
  return Math.max((lineCountOf(file) + file.hunks.length) * ROW_HEIGHT, ROW_HEIGHT);
}
