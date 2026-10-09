// finds the lines inside an edited moved block that differ between the old and new copy.
// those are real changes, so they must not be counted as move noise.

import type { DiffFile, MovedBlock } from "../../types";

export type Side = "-" | "+";

export const editedKey = (path: string, side: Side, line: number): string => `${path}\0${side}${line}`;

function textByLine(files: DiffFile[], side: "deletion" | "addition"): Map<string, string> {
  const out = new Map<string, string>();
  const mark: Side = side === "deletion" ? "-" : "+";
  for (const file of files) {
    for (const hunk of file.hunks) {
      for (const l of hunk.lines) {
        const line = side === "deletion" ? l.oldLine : l.newLine;
        if (l.type === side && line !== null) out.set(editedKey(file.path, mark, line), l.content.trim());
      }
    }
  }
  return out;
}

export function editedMovedLines(files: DiffFile[], moved: MovedBlock[]): Set<string> {
  const edited = new Set<string>();
  const blocks = moved.filter((b) => b.edited);
  if (!blocks.length) return edited;
  const old = textByLine(files, "deletion");
  const added = textByLine(files, "addition");
  for (const { from, to } of blocks) {
    for (let k = 0; k <= from.end - from.start; k++) {
      const oldKey = editedKey(from.file, "-", from.start + k);
      const newKey = editedKey(to.file, "+", to.start + k);
      if (old.get(oldKey) === added.get(newKey)) continue;
      edited.add(oldKey);
      edited.add(newKey);
    }
  }
  return edited;
}
