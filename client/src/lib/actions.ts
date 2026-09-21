import type { Action } from "svelte/action";

// svelte action: call `onEnter` once when the node scrolls within ~400px of the viewport, then
// stop observing. drives near-viewport lazy mounting of heavy diff bodies.
export const nearViewport: Action<HTMLElement, () => void> = (node, onEnter) => {
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        onEnter?.();
        observer.disconnect();
      }
    },
    { rootMargin: "400px" },
  );
  observer.observe(node);
  return { destroy: () => observer.disconnect() };
};
