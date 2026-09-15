// text states swap (transitions.dev 04): the shown label lags `text` by one exit phase so the
// old text leaves up and blurred while the new one enters from below. `labels` — every value
// the slot can show — are stacked invisibly so the control never changes width when it swaps.
import { html, useState, useEffect, useRef } from "/preact.js";
import { tokenMs } from "/motion.js";

const DURATION_TOKEN = "--text-swap-dur";

export function SwapText({ text, labels }) {
  const ref = useRef(null);
  const [shown, setShown] = useState({ text, entering: false });
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (text === shown.text) return setExiting(false); // changed back before the exit finished
    setExiting(true);
    const id = setTimeout(() => {
      setExiting(false);
      setShown({ text, entering: true });
    }, tokenMs(DURATION_TOKEN));
    return () => clearTimeout(id);
  }, [text]);

  // the enter-start jump (below, blurred, no transition) is in the dom — reflow it, then release
  useEffect(() => {
    if (!shown.entering) return;
    void ref.current?.offsetHeight;
    setShown({ text: shown.text, entering: false });
  }, [shown]);

  const state = exiting ? "is-exit" : shown.entering ? "is-enter-start" : "";
  return html`<span class="text-swap-slot">
    ${(labels ?? [text]).map((label) => html`<span class="text-swap-ghost" aria-hidden="true" key=${label}>${label}</span>`)}
    <span class="text-swap ${state}" ref=${ref}>${shown.text}</span>
  </span>`;
}
