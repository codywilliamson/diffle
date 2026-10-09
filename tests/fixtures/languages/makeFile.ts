import type { DiffFile, DiffLine } from "../../../src/types";

// "-text" = deletion, "+text" = addition, anything else = context; numbers start at the given lines
export function makeFile(path: string, rows: string[], oldStart = 1, newStart = 1): DiffFile {
  let oldLine = oldStart;
  let newLine = newStart;
  const lines: DiffLine[] = rows.map((row) => {
    const content = row.slice(1);
    if (row.startsWith("-")) return { type: "deletion", oldLine: oldLine++, newLine: null, content };
    if (row.startsWith("+")) return { type: "addition", oldLine: null, newLine: newLine++, content };
    return { type: "context", oldLine: oldLine++, newLine: newLine++, content };
  });
  const count = (type: DiffLine["type"]): number => lines.filter((l) => l.type === type).length;
  return {
    path,
    oldPath: null,
    changeType: "modified",
    additions: count("addition"),
    deletions: count("deletion"),
    hunks: [{ header: "@@", lines }],
  };
}
