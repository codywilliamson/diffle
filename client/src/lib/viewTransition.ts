// smooth crossfade for state changes (theme swap) via the View Transitions API.
// feature-detected + reduced-motion gated; falls back to a synchronous update.

export function withViewTransition(update: () => void): void {
  const prefersReduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (typeof document.startViewTransition === "function" && !prefersReduced) {
    document.startViewTransition(update);
  } else {
    update();
  }
}
