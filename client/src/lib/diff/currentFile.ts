import { fileAnchorId } from "./tree";

// slack for a section scrolled to the pane top, which can land on a fractional pixel.
const PANE_TOP_SLACK_PX = 8;

const rectOf = (path: string): DOMRect | undefined =>
  document.getElementById(fileAnchorId(path))?.getBoundingClientRect();

// the file the reviewer is looking at in all-files view: the selected one while it's still on
// screen, otherwise whichever section spans the top of the scrolled diff pane.
export function currentFile(paths: string[], active: string | null): string | undefined {
  const pane = document.querySelector("[data-diff-pane]")?.getBoundingClientRect();
  if (!pane || pane.height === 0) return active ?? paths[0];
  const activeRect = active ? rectOf(active) : undefined;
  if (active && activeRect && activeRect.bottom > pane.top && activeRect.top < pane.bottom) return active;
  return paths.findLast((path) => (rectOf(path)?.top ?? Infinity) <= pane.top + PANE_TOP_SLACK_PX) ?? paths[0];
}
