// tiny DiffFile builders for analysis tests. lines are "-text", "+text" or " text".

import type { DiffFile, DiffHunk, DiffLine } from "../../../src/types";

export function hunk(oldStart: number, newStart: number, marked: string[]): DiffHunk {
  let o = oldStart;
  let n = newStart;
  const lines: DiffLine[] = marked.map((m) => {
    const content = m.slice(1);
    if (m[0] === "-") return { type: "deletion", oldLine: o++, newLine: null, content };
    if (m[0] === "+") return { type: "addition", oldLine: null, newLine: n++, content };
    return { type: "context", oldLine: o++, newLine: n++, content };
  });
  return { header: `@@ -${oldStart} +${newStart} @@`, lines };
}

export function file(path: string, hunks: DiffHunk[]): DiffFile {
  const all = hunks.flatMap((h) => h.lines);
  return {
    path,
    oldPath: null,
    changeType: "modified",
    additions: all.filter((l) => l.type === "addition").length,
    deletions: all.filter((l) => l.type === "deletion").length,
    hunks,
  };
}
