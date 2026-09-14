// shared helpers for the transitions.dev recipes: token durations that honor reduced
// motion, a two-phase open/close hook, and a class replay for one-shot animations.
import { useState, useEffect, useCallback } from "/preact.js";

const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

// ms value of a :root custom property like "--modal-close-dur"; 0 under reduced motion.
export function tokenMs(name) {
  if (reducedMotion()) return 0;
  return parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || 0;
}

// enter/exit phases for a surface its parent renders conditionally. `phase` is "" on the
// first paint, "is-open" once mounted (so the open transition plays), and "is-closing"
// after requestClose(), which calls onClosed when the close duration token has elapsed.
export function useOpenClose(onClosed, closeToken) {
  const [entered, setEntered] = useState(false);
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    void document.body.offsetWidth; // flush the pre-open styles before flipping the class
    setEntered(true);
  }, []);
  const requestClose = useCallback(() => {
    setClosing((already) => {
      if (!already) setTimeout(onClosed, tokenMs(closeToken));
      return true;
    });
  }, [onClosed, closeToken]);
  return { phase: closing ? "is-closing" : entered ? "is-open" : "", requestClose };
}

// replays a class-driven animation: remove, reflow, re-add.
export function replayClass(el, cls) {
  if (!el) return;
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}
