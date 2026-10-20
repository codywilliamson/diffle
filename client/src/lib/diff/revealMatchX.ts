// scroll a search match sideways into view. with wrap off a long line overflows its scroller
// (the per-file box in unified, the per-pane box in split), so the active mark can sit far off screen.

export const REVEAL_X_MARGIN_PX = 48;

interface Span {
  left: number;
  right: number;
}

// how far to scroll horizontally so the span sits inside the box; 0 while it already does.
export function scrollDeltaX(mark: Span, box: Span, margin = REVEAL_X_MARGIN_PX): number {
  const gap = Math.min(margin, (box.right - box.left) / 4);
  if (mark.left < box.left + gap) return mark.left - (box.left + gap);
  if (mark.right > box.right - gap) return mark.right - (box.right - gap);
  return 0;
}

function horizontalScroller(el: HTMLElement): HTMLElement | null {
  for (let node = el.parentElement; node; node = node.parentElement) {
    const overflowX = getComputedStyle(node).overflowX;
    if ((overflowX === "auto" || overflowX === "scroll") && node.scrollWidth > node.clientWidth) return node;
  }
  return null;
}

// reveal the active search mark inside `row`, if there is one. returns true when it scrolled.
export function revealActiveMatchX(row: HTMLElement): boolean {
  const mark = row.querySelector<HTMLElement>("mark.sm-active");
  const scroller = mark && horizontalScroller(mark);
  if (!mark || !scroller) return false;
  const delta = scrollDeltaX(mark.getBoundingClientRect(), scroller.getBoundingClientRect());
  if (delta === 0) return false;
  scroller.scrollTo({ left: scroller.scrollLeft + delta, behavior: "instant" });
  return true;
}
