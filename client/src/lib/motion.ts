import { fade as svelteFade, fly as svelteFly, scale as svelteScale } from "svelte/transition";
import type { FadeParams, FlyParams, ScaleParams } from "svelte/transition";

// svelte transitions run on WAAPI, so a CSS media query alone won't stop them — gate in code:
// when the user prefers reduced motion, every transition collapses to duration 0.
function reduced(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function fade(node: Element, params: FadeParams = {}) {
  return svelteFade(node, reduced() ? { duration: 0 } : { duration: 140, ...params });
}

export function fly(node: Element, params: FlyParams = {}) {
  return svelteFly(node, reduced() ? { duration: 0 } : { duration: 180, y: 6, ...params });
}

export function scale(node: Element, params: ScaleParams = {}) {
  return svelteScale(node, reduced() ? { duration: 0 } : { duration: 150, start: 0.97, ...params });
}

// flip duration for reordering (animate:flip={FLIP}); 0 under reduced motion.
export const FLIP = { get duration() {
  return reduced() ? 0 : 180;
} };
