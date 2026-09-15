// release-update check: polls /api/update, and the pulsing "update available" badge.
import { html, useState, useEffect, useRef, useCallback } from "/preact.js";
import { getUpdate } from "/api.js";
import { useDismissablePopover } from "/popover.js";
import { Popover } from "/popoverSurface.js";

const POLL_MS = 10 * 60 * 1000;

// polls the server for loupe's release status; returns the latest UpdateStatus (or null).
export function useUpdateCheck() {
  const [status, setStatus] = useState(null);
  useEffect(() => {
    let alive = true;
    const check = () =>
      getUpdate()
        .then((s) => alive && setStatus(s))
        .catch(() => {});
    check();
    const id = setInterval(check, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);
  return status;
}

// pulsing dot shown when a newer release exists; click reveals pull instructions.
export function UpdateBadge({ status }) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapRef = useRef(null);
  const closeRef = useRef(null); // the popover's animated close, once it is mounted
  const close = () => closeRef.current?.();
  const onClosed = useCallback(() => setIsOpen(false), []);
  useDismissablePopover({ isOpen, close, panelRef: wrapRef });
  if (!status || !status.behind) return null;
  return html`<span class="update-wrap" ref=${wrapRef}>
    <button class="update-dot" title=${`loupe ${status.latest} available`} onClick=${() => (isOpen ? close() : setIsOpen(true))}></button>
    ${isOpen &&
    html`<${Popover} class="update-pop" onClosed=${onClosed} closeRef=${closeRef}>
      <div class="update-pop-head">
        loupe ${status.latest} available <span class="update-cur">(you have ${status.current})</span>
      </div>
      <p>Pull the latest, then restart loupe:</p>
      <code class="update-cmd">cd ${status.repoPath} && git pull</code>
    <//>`}
  </span>`;
}
