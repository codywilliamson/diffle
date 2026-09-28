import { tick } from "svelte";
import { reduced } from "./motion";

// View Transitions API helpers: feature-detected + reduced-motion gated; otherwise a synchronous update.
const MORPH_NAME = "file-morph";

function canTransition(): boolean {
  return typeof document.startViewTransition === "function" && !reduced();
}

// smooth crossfade for state changes (theme swap).
export function withViewTransition(update: () => void): void {
  if (canTransition()) document.startViewTransition(update);
  else update();
}

// morphs `from` into whatever `target()` resolves to once the update has rendered
// (a tree row into its file's diff header). only one element holds the name at a time.
export function morphInto(from: HTMLElement, update: () => void, target: () => HTMLElement | null): void {
  if (!canTransition()) return update();
  from.style.viewTransitionName = MORPH_NAME;
  let to: HTMLElement | null = null;
  const transition = document.startViewTransition(async () => {
    from.style.viewTransitionName = "";
    update();
    await tick();
    to = target();
    if (to) to.style.viewTransitionName = MORPH_NAME;
  });
  transition.finished.finally(() => {
    if (to) to.style.viewTransitionName = "";
  });
}
