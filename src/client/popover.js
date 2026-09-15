// shared overlay dismissal: close keys (escape by default) for the topmost open overlay, plus
// outside-click for anchored popovers. modals and popovers both join the same stack.
import { useEffect } from "/preact.js";

// open overlays, oldest first — only the topmost (last) one reacts to a close key, so
// stacked overlays (e.g. review popover + a modal) close one at a time.
const openStack = [];
const ESCAPE = ["Escape"];

function leaveStack(close) {
  const at = openStack.indexOf(close);
  if (at !== -1) openStack.splice(at, 1);
}

// `close` starts the overlay's exit. it leaves the stack as soon as it runs, so a second key
// press reaches the overlay underneath while this one is still animating out.
export function useCloseKeys({ isOpen, close, keys = ESCAPE }) {
  useEffect(() => {
    if (!isOpen) return;
    openStack.push(close);
    // capture phase: run before shortcuts.js's document-level Escape handler, then stop it.
    const onKeyDown = (e) => {
      if (!keys.includes(e.key) || openStack.at(-1) !== close) return;
      leaveStack(close);
      close();
      e.stopPropagation();
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      leaveStack(close);
    };
  }, [isOpen]);
}

// anchored popovers also close on a pointer-down outside their panel (trigger included).
export function useDismissablePopover({ isOpen, close, panelRef }) {
  useCloseKeys({ isOpen, close });
  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (e) => {
      if (panelRef.current?.contains(e.target)) return;
      leaveStack(close);
      close();
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [isOpen]);
}
