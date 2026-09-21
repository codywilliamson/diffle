import { fade as svelteFade, fly as svelteFly, scale as svelteScale, slide as svelteSlide } from "svelte/transition";
import type { FadeParams, FlyParams, ScaleParams, SlideParams } from "svelte/transition";
import { cubicOut } from "svelte/easing";

// svelte transitions run on WAAPI, so a CSS media query alone won't stop them — gate in code:
// when the user prefers reduced motion, every transition collapses to duration 0.
function reduced(): boolean {
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
