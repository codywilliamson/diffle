// open-comment count on the review trigger: the dot pops in and out with the notification badge
// recipe (03) and re-enters its digits with the number pop-in (02) whenever the count changes.
import { html, useState, useRef, useEffect } from "/preact.js";
import { tokenMs, replayClass } from "/motion.js";

const CLOSE_TOKEN = "--badge-pop-close-dur";
const STAGGER_TAIL = 2; // how many trailing digits ride in behind the leading ones

// the leading digit always leads; up to two trailing digits carry data-stagger 1 / 2
function digitSpans(count) {
  const chars = String(count).split("");
  const tail = Math.min(STAGGER_TAIL, chars.length - 1);
  return chars.map((ch, i) => {
    const fromEnd = chars.length - 1 - i;
    return html`<span class="badge-digit" data-stagger=${fromEnd < tail ? tail - fromEnd : null} key=${i}>${ch}</span>`;
  });
}

// count 0 pops the dot out and then unmounts it; a fresh non-zero count pops it back in.
export function OpenBadge({ count }) {
  const ref = useRef(null);
  const shown = useRef(count); // digits stay on the dot while it pops out
  if (count > 0) shown.current = count;
  const [mounted, setMounted] = useState(count > 0);
  const [popped, setPopped] = useState(false); // data-open; flipped one paint after mount so the pop plays

  useEffect(() => {
    if (count === 0) {
      setPopped(false);
      const id = setTimeout(() => setMounted(false), tokenMs(CLOSE_TOKEN));
      return () => clearTimeout(id);
    }
    if (popped) replayClass(ref.current, "is-animating"); // the count changed while shown: re-enter the digits
    setMounted(true);
  }, [count]);

  // pops the dot once it has painted at scale(0): on mount, or when a new count lands mid pop-out
  useEffect(() => {
    if (!mounted || count === 0) return;
    void ref.current?.offsetWidth;
    setPopped(true);
  }, [mounted, count]);

  if (!mounted) return null;
  return html`<span class="badge badge-open" data-open=${popped} ref=${ref}>${digitSpans(shown.current)}</span>`;
}
