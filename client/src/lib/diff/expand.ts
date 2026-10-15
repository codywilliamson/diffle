// gitlab-style context expansion: reveal the unchanged lines git hides between hunks. pure — the
// caller supplies the file's new-side lines. gap g sits above hunk g (gap 0 before the first
// hunk); gap n follows the last hunk. revealed lines become ordinary context lines in the
// neighbouring hunk, so the hunk count and indices (which annotations key on) stay stable.

import type { DiffFile, DiffLine } from "$types";

export const EXPAND_STEP = 20;

// "1 hidden line" / "4 hidden lines": every gap label counts lines through this.
export const linesLabel = (count: number, kind: string): string => `${count} ${kind} ${count === 1 ? "line" : "lines"}`;

export type RevealHow = "up" | "down" | "all"; // up: grow the hunk below upward; down: the hunk above downward

interface Range {
  first: number;
  last: number; // first - 1 when the side is empty
}

export interface Gap {
  index: number;
  start: number; // new-side line numbers, inclusive; end = start - 1 when empty
  end: number;
  offset: number; // old line = new line + offset inside the gap
  above: boolean; // a hunk precedes it (it can grow down)
  below: boolean; // a hunk follows it (it can grow up)
}

export interface Reveal {
  top: number; // lines shown from the gap's start (under the hunk above)
  bottom: number; // lines shown from the gap's end (over the hunk below)
}

export interface GapView {
  index: number;
  size: number;
  hidden: number;
  revealed: boolean; // some of it is already shown
  canDown: boolean;
  canUp: boolean;
}

const HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;
const NO_REVEAL: Reveal = { top: 0, bottom: 0 };

function sideRange(start: number, count: number): Range {
  return count === 0 ? { first: start + 1, last: start } : { first: start, last: start + count - 1 };
}

function rangesOf(header: string): { old: Range; new: Range } | null {
  const m = HEADER.exec(header);
  if (!m) return null;
  const count = (raw: string | undefined) => (raw === undefined ? 1 : Number(raw));
  return { old: sideRange(Number(m[1]), count(m[2])), new: sideRange(Number(m[3]), count(m[4])) };
}

// whether the loaded text still reads like the diff: it may come from a later disk state.
export function matchesText(file: DiffFile, lines: string[]): boolean {
  if (file.lineCount != null && lines.length !== file.lineCount) return false;
  return file.hunks.every((hunk) =>
    hunk.lines.every((l) => l.newLine == null || lines[l.newLine - 1] === l.content.replace(/\r$/, "")),
  );
}

// null when a header is missing or disagrees with its lines — expansion is then not offered.
export function gapsOf(file: DiffFile, totalLines: number): Gap[] | null {
  if (file.hunks.length === 0) return null;
  const ranges = file.hunks.map((hunk) => rangesOf(hunk.header));
  for (const [i, range] of ranges.entries()) {
    const firstNew = file.hunks[i]!.lines.find((l) => l.newLine != null)?.newLine;
    if (!range || (firstNew != null && firstNew !== range.new.first) || range.new.last > totalLines) return null;
  }
  const known = ranges as { old: Range; new: Range }[];
  return Array.from({ length: known.length + 1 }, (_, g) => {
    const prev = known[g - 1];
    const next = known[g];
    const start = prev ? prev.new.last + 1 : 1;
    const end = Math.max(start - 1, next ? next.new.first - 1 : totalLines);
    const offset = prev ? prev.old.last - prev.new.last : next!.old.first - next!.new.first;
    return { index: g, start, end, offset, above: !!prev, below: !!next };
  });
}

// how much of each gap is shown: never more than the gap, and only from a side with a hunk.
function shownOf(gap: Gap, reveal: Reveal): Reveal {
  const size = gap.end - gap.start + 1;
  if (!gap.above) return { top: 0, bottom: Math.min(reveal.top + reveal.bottom, size) };
  if (!gap.below) return { top: Math.min(reveal.top + reveal.bottom, size), bottom: 0 };
  const top = Math.min(reveal.top, size);
  return { top, bottom: Math.min(reveal.bottom, size - top) };
}

export function nextReveal(gap: Gap, current: Reveal, how: RevealHow): Reveal {
  const size = gap.end - gap.start + 1;
  if (how === "all") return gap.above ? { top: size, bottom: 0 } : { top: 0, bottom: size };
  return how === "down" ? { ...current, top: current.top + EXPAND_STEP } : { ...current, bottom: current.bottom + EXPAND_STEP };
}

// the reveal each gap needs so every given new-side range (a comment's lines) is shown, taken
// from whichever side of the gap is closer.
export function revealsFor(gaps: Gap[], ranges: { start: number; end: number }[]): Map<number, Reveal> {
  const out = new Map<number, Reveal>();
  for (const gap of gaps) {
    for (const r of ranges) {
      const lo = Math.max(r.start, gap.start);
      const hi = Math.min(r.end, gap.end);
      if (lo > hi) continue;
      const fromTop = hi - gap.start + 1;
      const fromBottom = gap.end - lo + 1;
      const useTop = gap.above && (!gap.below || fromTop <= fromBottom);
      const prev = out.get(gap.index) ?? NO_REVEAL;
      out.set(gap.index, useTop ? { ...prev, top: Math.max(prev.top, fromTop) } : { ...prev, bottom: Math.max(prev.bottom, fromBottom) });
    }
  }
  return out;
}

export function mergeReveals(a: ReadonlyMap<number, Reveal>, b: ReadonlyMap<number, Reveal>): Map<number, Reveal> {
  const out = new Map(a);
  for (const [g, r] of b) {
    const prev = out.get(g) ?? NO_REVEAL;
    out.set(g, { top: Math.max(prev.top, r.top), bottom: Math.max(prev.bottom, r.bottom) });
  }
  return out;
}

export interface Expanded {
  file: DiffFile;
  views: GapView[]; // one per gap: views[g] above hunk g, views[hunks.length] after the last
}

export function expandFile(file: DiffFile, gaps: Gap[], lines: string[], reveals: ReadonlyMap<number, Reveal>): Expanded {
  const shown = gaps.map((gap) => shownOf(gap, reveals.get(gap.index) ?? NO_REVEAL));
  const context = (gap: Gap, from: number, to: number): DiffLine[] =>
    Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => {
      const n = from + i;
      return { type: "context", oldLine: n + gap.offset, newLine: n, content: lines[n - 1] ?? "" };
    });
  const hunks = file.hunks.map((hunk, h) => {
    const above = gaps[h]!;
    const below = gaps[h + 1]!;
    return {
      ...hunk,
      lines: [
        ...context(above, above.end - shown[h]!.bottom + 1, above.end),
        ...hunk.lines,
        ...context(below, below.start, below.start + shown[h + 1]!.top - 1),
      ],
    };
  });
  const views = gaps.map((gap, g) => {
    const size = gap.end - gap.start + 1;
    const hidden = size - shown[g]!.top - shown[g]!.bottom;
    return { index: g, size, hidden, revealed: hidden < size, canDown: gap.above && hidden > 0, canUp: gap.below && hidden > 0 };
  });
  return { file: { ...file, hunks }, views };
}

// whether a hunk's header row shows, and what it says: a gap with hidden lines gets an expander;
// a fully revealed gap merges into the code; an untouched one keeps git's own header text.
export function headerRow(view: GapView | undefined, header: string): { show: boolean; label: string } {
  if (!view) return { show: !!header, label: header };
  if (view.hidden > 0) return { show: true, label: view.revealed ? linesLabel(view.hidden, "hidden") : header };
  return { show: view.size === 0 && !!header, label: header };
}

// the new-side text split into lines, without the empty string a trailing newline leaves.
export function splitLines(text: string): string[] {
  const lines = text.split(/\r?\n/);
  if (lines.at(-1) === "") lines.pop();
  return lines;
}
