import { fade as svelteFade, fly as svelteFly, scale as svelteScale, slide as svelteSlide } from "svelte/transition";
import type { FadeParams, FlyParams, ScaleParams, SlideParams } from "svelte/transition";
import { cubicOut } from "svelte/easing";

// svelte transitions run on WAAPI, so a CSS media query alone won't stop them — gate in code:
// when the user prefers reduced motion, every transition collapses to duration 0.
export function reduced(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function fade(node: Element, params: FadeParams = {}) {
  return svelteFade(node, reduced() ? { duration: 0 } : { duration: 180, easing: cubicOut, ...params });
}

export function fly(node: Element, params: FlyParams = {}) {
  return svelteFly(node, reduced() ? { duration: 0 } : { duration: 240, y: 8, easing: cubicOut, ...params });
}

export function scale(node: Element, params: ScaleParams = {}) {
  return svelteScale(node, reduced() ? { duration: 0 } : { duration: 190, start: 0.96, easing: cubicOut, ...params });
}

export function slide(node: Element, params: SlideParams = {}) {
  return svelteSlide(node, reduced() ? { duration: 0 } : { duration: 200, easing: cubicOut, ...params });
}

// flip duration for reordering (animate:flip={FLIP}); 0 under reduced motion.
export const FLIP = {
  easing: cubicOut,
  get duration() {
    return reduced() ? 0 : 220;
  },
};

// staggered rise-in for the first rows of a freshly mounted diff; rows past the cap
// are usually off-screen, so they appear instantly. no-op under reduced motion.
const STAGGER_ROWS = 40;
const STAGGER_STEP_MS = 12;

export function revealRows(node: HTMLElement) {
  if (reduced()) return;
  const rows = Array.from(node.querySelectorAll<HTMLElement>(".diff-row")).slice(0, STAGGER_ROWS);
  for (const [i, row] of rows.entries()) {
    row.animate?.(
      [
        { opacity: 0, transform: "translateY(4px)" },
        { opacity: 1, transform: "none" },
      ],
      { duration: 220, delay: i * STAGGER_STEP_MS, easing: "cubic-bezier(0.33, 1, 0.68, 1)", fill: "backwards" },
    );
  }
}
