import type { Action } from "svelte/action";

// shift+wheel pans only this side; at its edge, let the outer reading flow scroll vertically.
export const horizontalWheel: Action<HTMLElement> = (node) => {
  const wheel = (event: WheelEvent): void => {
    if (!event.shiftKey || event.ctrlKey) return;
    const delta = event.deltaX || event.deltaY;
    const limit = node.scrollWidth - node.clientWidth;
    if (!delta || limit <= 0 || (delta < 0 && node.scrollLeft <= 0) || (delta > 0 && node.scrollLeft >= limit - 1)) return;
    event.preventDefault();
    const unit = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 20 : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? node.clientWidth : 1;
    node.scrollLeft += delta * unit;
  };
  node.addEventListener("wheel", wheel, { passive: false });
  return { destroy: () => node.removeEventListener("wheel", wheel) };
};
