// syntax highlighting for a diff file. each hunk side is tokenized as one block (not per line) so
// multi-line constructs and embedded languages (a svelte <script>, a vue <style>) keep their
// context; the new-side file text, when given, seeds each hunk with the grammar state it starts in.
import type { DiffFile, DiffHunk, DiffLine } from "$types";
import { languageFor } from "./languages";
import { highlighterFor, highlightLines, stateAfter, type GrammarState } from "./highlighter";

export type LineHtml = Map<DiffLine, string>;

const PURE_DELETION = /\+(\d+),0\b/;
// reading context runs on the main thread (~0.1ms/line); past this a huge file isn't worth the stall.
const MAX_CONTEXT_LINES = 4000;

// how many new-side lines come before the hunk.
function linesBefore(hunk: DiffHunk): number {
  const first = hunk.lines.find((l) => l.newLine != null)?.newLine;
  if (first != null) return first - 1;
  return Number(PURE_DELETION.exec(hunk.header)?.[1] ?? 0);
}

// modified files whose hunks start mid-file need the full text to know their starting context.
export function needsFileText(file: DiffFile): boolean {
  return (file.changeType === "modified" || file.changeType === "renamed") && file.hunks.some((h) => linesBefore(h) > 0);
}

// highlighted html per diff line; empty when the language has no grammar.
export async function highlightFile(file: DiffFile, newText: string | null): Promise<LineHtml> {
  const html: LineHtml = new Map();
  const lang = languageFor(file.path);
  const hl = lang ? await highlighterFor(lang) : null;
  if (!lang || !hl) return html;

  const lines = newText?.split(/\r?\n/);
  const source = lines && lines.length <= MAX_CONTEXT_LINES ? lines : null;
  let state: GrammarState | undefined;
  let consumed = 0;
  for (const hunk of file.hunks) {
    if (source) {
      const start = linesBefore(hunk);
      state = stateAfter(hl, source.slice(consumed, start), lang, state);
      consumed = start;
    }
    const oldSide = hunk.lines.filter((l) => l.type !== "addition");
    const newSide = hunk.lines.filter((l) => l.type !== "deletion");
    const old = highlightLines(hl, oldSide.map((l) => l.content), lang, state);
    const next = highlightLines(hl, newSide.map((l) => l.content), lang, state);
    oldSide.forEach((l, i) => l.type === "deletion" && html.set(l, old.lines[i] ?? ""));
    newSide.forEach((l, i) => html.set(l, next.lines[i] ?? ""));
    // without the file text, carry the state across hunks as a best effort.
    if (!source) state = newSide.length ? next.state : old.state;
  }
  return html;
}
