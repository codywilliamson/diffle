// inline reply composer for a comment thread. autofocuses; Ctrl/Cmd+Enter sends, Esc cancels.
// rises in with the panel reveal (07) and exits through useOpenClose, so the card's onCancel runs
// only once the close has played; escape joins the overlay close stack (popover.js). onSend may
// return a promise: pending disables the buttons, rejection keeps the draft, shakes the composer
// (12) and reveals the error inline instead of the app-wide fatal screen.
import { html, useState, useRef, useEffect } from "/preact.js";
import { useOpenClose } from "/motion.js";
import { useCloseKeys } from "/popover.js";
import { shake, onShakeEnd } from "/shake.js";

const CLOSE_TOKEN = "--editor-close-dur";
const noop = () => {};

// server errors arrive as "Error: <message>" — strip that prefix for display.
const cleanError = (e) => String(e).replace(/^Error:\s*/, "");

// mounts with the message and fades it in on the next frame
function ReplyError({ message }) {
  const { phase } = useOpenClose(noop, CLOSE_TOKEN);
  return html`<div class="reply-error ${phase}">${message}</div>`;
}

export function ReplyComposer({ onSend, onCancel }) {
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState(null); // a fresh object per failure so repeats replay the shake
  const ref = useRef(null);
  const inputRef = useRef(null);
  const { phase, requestClose } = useOpenClose(onCancel, CLOSE_TOKEN);
  useCloseKeys({ isOpen: true, close: requestClose });
  useEffect(() => inputRef.current?.focus(), []);
  useEffect(() => { if (failure) shake(ref.current); }, [failure]);

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    setPending(true);
    setFailure(null);
    Promise.resolve(onSend(trimmed)).catch((e) => {
      setPending(false);
      setFailure({ message: cleanError(e) });
    });
  };
  const onKeyDown = (e) => {
    if (phase === "is-closing" || e.key !== "Enter" || !(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    submit();
  };

  return html`<div class="reply-composer ${phase} ${failure ? "is-error" : ""}" ref=${ref} onAnimationEnd=${onShakeEnd}>
    <textarea
      ref=${inputRef}
      class="comment-input"
      aria-label="Reply"
      value=${text}
      onInput=${(e) => setText(e.target.value)}
      onKeyDown=${onKeyDown}
      placeholder="Reply…"
    ></textarea>
    <div class="comment-actions">
      <button class="btn-primary" onClick=${submit} disabled=${!text.trim() || pending}>Send</button>
      <button class="btn-plain" onClick=${requestClose} disabled=${pending}>Cancel</button>
    </div>
    ${failure && html`<${ReplyError} message=${failure.message} />`}
  </div>`;
}
