import type { Comment, DiffFile, DiffLine } from "$types";
import { commentsForLine, isAddingAt, type AddTarget } from "./threads";
import { pairLines, hunkMarks, type CharRange, type SplitRow } from "./wordDiff";

export type SplitDisplayRow =
  | { key: string; kind: "header"; text: string }
  | { key: string; kind: "code"; pair: SplitRow; marks: Map<DiffLine, CharRange> }
  | { key: string; kind: "comment"; pair: SplitRow; oldComments: Comment[]; newComments: Comment[]; oldAdding: boolean; newAdding: boolean };

// both panes render the same row slots, including a shared slot for comments on either side.
export function splitRows(file: DiffFile, comments: Comment[], adding: AddTarget | null): SplitDisplayRow[] {
  const result: SplitDisplayRow[] = [];
  const fileComments = comments.filter((comment) => comment.file === file.path);
  file.hunks.forEach((hunk, hi) => {
    if (hunk.header) result.push({ key: `${hi}-header`, kind: "header", text: hunk.header });
    const marks = hunkMarks(hunk.lines);
    pairLines(hunk.lines).forEach((pair, ri) => {
      const key = `${hi}-${ri}`;
      result.push({ key, kind: "code", pair, marks });
      const oldLine = pair.left?.oldLine;
      const newLine = pair.right?.newLine;
      const oldComments = oldLine != null ? commentsForLine(fileComments, "old", oldLine) : [];
      const newComments = newLine != null ? commentsForLine(fileComments, "new", newLine) : [];
      const oldAdding = oldLine != null && isAddingAt(adding, file.path, "old", oldLine);
      const newAdding = newLine != null && isAddingAt(adding, file.path, "new", newLine);
      if (oldComments.length || newComments.length || oldAdding || newAdding) {
        result.push({ key: `${key}-comment`, kind: "comment", pair, oldComments, newComments, oldAdding, newAdding });
      }
    });
  });
  return result;
}
