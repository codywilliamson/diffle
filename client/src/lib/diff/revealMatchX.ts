// scroll a search match sideways into view. with wrap off a long line overflows its scroller
// (the per-file box in unified, the per-pane box in split), so the active mark can sit far off screen.

export const REVEAL_X_MARGIN_PX = 48;

interface Span {
  left: number;
  right: number;
}

// how far to scroll horizontally so the span sits inside the box; 0 while it already does.
// `leftInset` is a sticky gutter pinned over the box's left edge, which hides whatever scrolls under it.
export function scrollDeltaX(mark: Span, box: Span, leftInset = 0, margin = REVEAL_X_MARGIN_PX): number {
  const left = box.left + leftInset;
  const gap = Math.min(margin, (box.right - left) / 4);
  if (mark.left < left + gap) return mark.left - (left + gap);
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
  const gutter = mark.closest(".split-line")?.querySelector<HTMLElement>(".split-gutter");
  const delta = scrollDeltaX(mark.getBoundingClientRect(), scroller.getBoundingClientRect(), gutter?.offsetWidth ?? 0);
  if (delta === 0) return false;
  scroller.scrollTo({ left: scroller.scrollLeft + delta, behavior: "instant" });
  return true;
}
