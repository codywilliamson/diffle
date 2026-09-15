// anchored popover surface with the two-phase open/close (transitions.dev 05-menu-dropdown).
// the parent keeps rendering it until onClosed fires; closeRef receives the animated
// requestClose so the parent's trigger, dismissal hook and actions can start the exit.
import { html } from "/preact.js";
import { useOpenClose } from "/motion.js";

const CLOSE_TOKEN = "--dropdown-close-dur";

// origin: which corner of the trigger the surface grows from (top-left | top-right)
export function Popover({ onClosed, closeRef, origin = "top-left", class: cls = "", surfaceRef, children, ...attrs }) {
  const { phase, requestClose } = useOpenClose(onClosed, CLOSE_TOKEN);
  closeRef.current = requestClose;
  return html`<div ...${attrs} class="popover ${cls} ${phase}" data-origin=${origin} ref=${surfaceRef}>${children}</div>`;
}
