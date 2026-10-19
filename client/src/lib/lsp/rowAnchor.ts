// which side and line a language server should be asked about for a diff row: removed lines are
// the old file's, everything else (added and unchanged, on either split pane) is the new file's.

import type { DiffLine, LspSide } from "$types";

export function lspAnchor(line: DiffLine): { side: LspSide; line: number } | null {
  if (line.type === "deletion") return line.oldLine == null ? null : { side: "old", line: line.oldLine };
  return line.newLine == null ? null : { side: "new", line: line.newLine };
}
