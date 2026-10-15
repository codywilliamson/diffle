import type { Comment, DiffFile, DiffLine } from "$types";
import { commentsForLine, isAddingAt, type AddTarget } from "./threads";
import { pairLines, hunkMarks, type CharRange, type SplitRow } from "./wordDiff";
import { headerRow, linesLabel, type GapView } from "./expand";

export type SplitDisplayRow =
  | {
      key: string;
      kind: "header";
      text: string;
      gap?: GapView; // a context gap with hidden lines gets an expander
      gapIndex: number;
    }
  | {
      key: string;
      kind: "code";
      pair: SplitRow;
      marks: Map<DiffLine, CharRange>;
    }
  | {
      key: string;
      kind: "comment";
      pair: SplitRow;
      oldComments: Comment[];
      newComments: Comment[];
      oldAdding: boolean;
      newAdding: boolean;
    };

// both panes render the same row slots, including a shared slot for comments on either side.
// a collapsed thread gets no slot (its line shows a pip instead); `views` are the context gaps.
export interface SplitRowOptions {
  collapsed?: (thread: Comment[]) => boolean;
  views?: GapView[];
}

export function splitRows(file: DiffFile, comments: Comment[], adding: AddTarget | null, options: SplitRowOptions = {}): SplitDisplayRow[] {
  const { collapsed = () => false, views } = options;
  const result: SplitDisplayRow[] = [];
  const fileComments = comments.filter((comment) => comment.file === file.path);
  file.hunks.forEach((hunk, hunkIndex) => {
    const gap = views?.[hunkIndex];
    const head = headerRow(gap, hunk.header);
    if (head.show) {
      result.push({ key: `${hunkIndex}-header`, kind: "header", text: head.label, ...(gap && gap.hidden > 0 ? { gap } : {}), gapIndex: hunkIndex });
    }
    const marks = hunkMarks(hunk.lines);
    pairLines(hunk.lines).forEach((pair, rowIndex) => {
      const key = `${hunkIndex}-${rowIndex}`;
      result.push({ key, kind: "code", pair, marks });
      const oldLine = pair.left?.oldLine;
      const newLine = pair.right?.newLine;
      const visible = (thread: Comment[]) => (collapsed(thread) ? [] : thread);
      const oldComments = oldLine != null ? visible(commentsForLine(fileComments, "old", oldLine)) : [];
      const newComments = newLine != null ? visible(commentsForLine(fileComments, "new", newLine)) : [];
      const oldAdding = oldLine != null && isAddingAt(adding, file.path, "old", oldLine);
      const newAdding = newLine != null && isAddingAt(adding, file.path, "new", newLine);
      const hasComments = oldComments.length > 0 || newComments.length > 0;
      const hasComposer = oldAdding || newAdding;
      if (hasComments || hasComposer) {
        result.push({
          key: `${key}-comment`,
          kind: "comment",
          pair,
          oldComments,
          newComments,
          oldAdding,
          newAdding,
        });
      }
    });
  });
  const tail = views?.[file.hunks.length];
  if (tail && tail.hidden > 0) {
    result.push({ key: `${file.hunks.length}-tail`, kind: "header", text: linesLabel(tail.hidden, "more"), gap: tail, gapIndex: file.hunks.length });
  }
  return result;
}
