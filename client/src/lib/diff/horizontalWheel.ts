import type { Action } from "svelte/action";

const LINE_SCROLL_PIXELS = 20;
const SCROLL_EDGE_TOLERANCE = 1;

function wheelUnit(event: WheelEvent, paneWidth: number): number {
  switch (event.deltaMode) {
    case WheelEvent.DOM_DELTA_LINE:
      return LINE_SCROLL_PIXELS;
    case WheelEvent.DOM_DELTA_PAGE:
      return paneWidth;
    default:
      return 1;
  }
}

// shift+wheel pans only this side; at its edge, let the outer reading flow scroll vertically.
export const horizontalWheel: Action<HTMLElement> = (node) => {
  function handleWheel(event: WheelEvent): void {
    if (!event.shiftKey || event.ctrlKey) return;

    const delta = event.deltaX || event.deltaY;
    const scrollLimit = node.scrollWidth - node.clientWidth;
    const atStart = delta < 0 && node.scrollLeft <= 0;
    const atEnd = delta > 0 && node.scrollLeft >= scrollLimit - SCROLL_EDGE_TOLERANCE;
    if (!delta || scrollLimit <= 0 || atStart || atEnd) return;

    event.preventDefault();
    node.scrollLeft += delta * wheelUnit(event, node.clientWidth);
  }

  node.addEventListener("wheel", handleWheel, { passive: false });
  return {
    destroy(): void {
      node.removeEventListener("wheel", handleWheel);
    },
  };
};
