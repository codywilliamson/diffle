// shared modal frame: scrim + dialog with the two-phase open/close (transitions.dev 06-modal).
// every close path — x button, footer button, scrim click, escape — goes through the animated
// requestClose; onClose fires once the exit has played so the parent can unmount the modal.
import { html, useRef, useCallback } from "/preact.js";
import { useOpenClose } from "/motion.js";
import { useCloseKeys } from "/popover.js";

const CLOSE_TOKEN = "--modal-close-dur";

// children is a render function receiving the animated close: (close) => nodes
export function Modal({ onClose, labelledBy, class: cls = "", closeKeys, children }) {
  const onCloseRef = useRef(onClose); // latest callback without re-keying the close stack
  onCloseRef.current = onClose;
  const onClosed = useCallback(() => onCloseRef.current(), []);
  const { phase, requestClose } = useOpenClose(onClosed, CLOSE_TOKEN);
  useCloseKeys({ isOpen: true, close: requestClose, keys: closeKeys });
  return html`<div class="modal-backdrop ${phase}" onClick=${requestClose}>
    <div class="modal ${cls} ${phase}" role="dialog" aria-modal="true" aria-labelledby=${labelledBy} onClick=${(e) => e.stopPropagation()}>
      ${children(requestClose)}
    </div>
  </div>`;
}
