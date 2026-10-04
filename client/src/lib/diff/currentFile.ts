// slack for a section scrolled to the pane top, which can land on a fractional pixel.
const PANE_TOP_SLACK_PX = 8;

// keyed by exact path, since sanitized anchor ids can collide (a/b.ts vs a-b.ts). only the direct
// children of the real list (the first in document order, an ancestor of any rendered markdown),
// so markers copied into a reviewed file's preview can't pose as sections.
function sectionRects(pane: Element): Map<string, DOMRect> {
  const list = pane.querySelector("[data-file-sections]");
  const sections = [...(list?.children ?? [])].filter((el): el is HTMLElement => el instanceof HTMLElement && !!el.dataset.filePath);
  return new Map(sections.map((el) => [el.dataset.filePath ?? "", el.getBoundingClientRect()]));
}

// the file the reviewer is looking at in all-files view: the selected one while it's still on
// screen, otherwise whichever section spans the top of the scrolled diff pane.
export function currentFile(paths: string[], active: string | null): string | undefined {
  const paneEl = document.querySelector("[data-diff-pane]");
  const pane = paneEl?.getBoundingClientRect();
  if (!paneEl || !pane || pane.height === 0) return active ?? paths[0];
  const rects = sectionRects(paneEl);
  const activeRect = active ? rects.get(active) : undefined;
  if (active && activeRect && activeRect.bottom > pane.top && activeRect.top < pane.bottom) return active;
  return paths.findLast((path) => (rects.get(path)?.top ?? Infinity) <= pane.top + PANE_TOP_SLACK_PX) ?? paths[0];
}
