import type { Action } from "svelte/action";

// svelte action: call `onOutside` on a pointer press outside the node. deferred one tick so the
// press that opened the popover doesn't immediately close it.
export const clickOutside: Action<HTMLElement, () => void> = (node, onOutside) => {
  const handler = (e: MouseEvent): void => {
    if (!node.contains(e.target as Node)) onOutside?.();
  };
  const id = setTimeout(() => document.addEventListener("mousedown", handler), 0);
  return {
    destroy: () => {
      clearTimeout(id);
      document.removeEventListener("mousedown", handler);
    },
  };
};

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
