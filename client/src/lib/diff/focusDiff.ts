// hand keyboard focus back to the diff pane (the editor just closed), without scrolling.
export function focusDiff(): void {
  document.querySelector<HTMLElement>("[data-diff-pane]")?.focus({ preventScroll: true });
}

const EDGE_MARGIN_PX = 48; // clear of the sticky file header

// bring an element fully into the diff pane when it is cut off (or hidden under the header).
export function revealInDiff(el: HTMLElement): void {
  const pane = el.closest("[data-diff-pane]") ?? document.querySelector("[data-diff-pane]");
  const bounds = pane?.getBoundingClientRect() ?? { top: 0, bottom: window.innerHeight };
  const box = el.getBoundingClientRect();
  if (box.top < bounds.top + EDGE_MARGIN_PX || box.bottom > bounds.bottom) el.scrollIntoView?.({ block: "center" }); // absent in jsdom
}
