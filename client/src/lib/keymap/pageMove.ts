// Ctrl+d / Ctrl+u: land on the rendered row half a viewport away, measured in pixels so wrapped
// lines and inline comment boxes count for their real height. returns null when the target
// falls outside the mounted rows (or there is no cursor row to measure from), and the caller
// falls back to a row-count estimate.

import type { Side } from "$lib/diff/threads";
import type { CursorPos } from "$lib/state/cursorSteps";

export const PAGE_FRACTION = 0.5;

interface Measured {
  pos: CursorPos;
  center: number;
  top: number;
  bottom: number;
  el: HTMLElement;
}

function rowPos(el: HTMLElement, splitSide: Side | null): CursorPos | null {
  const path = el.closest<HTMLElement>("[data-file-path]")?.dataset.filePath;
  if (!path) return null;
  const oldLine = Number(el.dataset.oldline);
  const newLine = Number(el.dataset.newline);
  const has = (v: string | undefined, n: number): boolean => v !== undefined && v !== "" && n > 0;
  if (splitSide) {
    const n = splitSide === "old" ? oldLine : newLine;
    return has(splitSide === "old" ? el.dataset.oldline : el.dataset.newline, n) ? { path, side: splitSide, line: n } : null;
  }
  if (has(el.dataset.newline, newLine)) return { path, side: "new", line: newLine };
  return has(el.dataset.oldline, oldLine) ? { path, side: "old", line: oldLine } : null;
}

export function pagePosition(direction: 1 | -1, count: number): CursorPos | null {
  const pane = document.querySelector<HTMLElement>("[data-diff-pane]");
  const current = pane?.querySelector<HTMLElement>("[data-cursor]");
  if (!pane || !current) return null;
  const isSplit = current.classList.contains("split-line");
  const side: Side | null = isSplit ? (current.closest(".split-pane-old") ? "old" : "new") : null;
  const selector = isSplit ? `.split-pane-${side} .diff-row` : "tr.diff-row";

  const rows: Measured[] = [];
  for (const el of pane.querySelectorAll<HTMLElement>(selector)) {
    const pos = rowPos(el, side);
    if (!pos) continue;
    const r = el.getBoundingClientRect();
    rows.push({ pos, el, top: r.top, bottom: r.bottom, center: (r.top + r.bottom) / 2 });
  }
  const from = rows.find((r) => r.el === current);
  if (!from || rows.length === 0) return null;

  const target = from.center + direction * count * pane.clientHeight * PAGE_FRACTION;
  if (target < rows[0]!.top || target > rows[rows.length - 1]!.bottom) return null;
  const best = rows.reduce((a, c) => (Math.abs(c.center - target) < Math.abs(a.center - target) ? c : a));
  return best.el === current ? null : best.pos;
}
