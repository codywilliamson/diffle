// the new/edit comment editor. rises into the thread with the panel reveal (07) and exits through
// useOpenClose, so the parent's onCancel runs only once the close has played. escape joins the
// overlay close stack (popover.js) so the exit plays instead of the global shortcut unmounting it.
// ctrl/cmd+enter on empty text shakes the card (12) instead of silently doing nothing.
import { html, useState, useRef, useEffect } from "/preact.js";
import { useOpenClose } from "/motion.js";
import { useCloseKeys } from "/popover.js";
import { shake, onShakeEnd } from "/shake.js";

const CLOSE_TOKEN = "--editor-close-dur";

// auto-resizing textarea that grows with its content.
function AutoTextarea({ value, onInput, onKeyDown }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
    el.focus();
  }, [value]);
  return html`<textarea
    ref=${ref}
    class="comment-input"
    value=${value}
    onInput=${(e) => onInput(e.target.value)}
    onKeyDown=${onKeyDown}
    placeholder="Leave a comment…"
  ></textarea>`;
}

export const TAGS = ["nit", "issue", "question", "praise"];

// optional tag row; clicking the active tag clears it.
function TagPicker({ tag, onTag }) {
  return html`<div class="tag-picker">
    ${TAGS.map(
      (t) => html`<button
        key=${t}
        class="tag-pill tag-${t} ${tag === t ? "on" : ""}"
        onClick=${() => onTag(tag === t ? undefined : t)}
      >${t}</button>`
    )}
  </div>`;
}

// onSave(text, tag) swaps the editor out at once; onCancel() fires after the exit.
export function CommentEditor({ initial = "", initialTag, onSave, onCancel }) {
  const [text, setText] = useState(initial);
  const [tag, setTag] = useState(initialTag);
  const ref = useRef(null);
  const { phase, requestClose } = useOpenClose(onCancel, CLOSE_TOKEN);
  useCloseKeys({ isOpen: true, close: requestClose });
  const submit = () => {
    const trimmed = text.trim();
    if (trimmed) onSave(trimmed, tag);
    else shake(ref.current);
  };
  const onKeyDown = (e) => {
    if (phase !== "is-closing" && e.key === "Enter" && (e.ctrlKey || e.metaKey)) submit();
  };
  return html`<div class="comment-card editing ${phase}" ref=${ref} onAnimationEnd=${onShakeEnd}>
    <${AutoTextarea} value=${text} onInput=${setText} onKeyDown=${onKeyDown} />
    <div class="comment-actions">
      <button class="btn-primary" onClick=${submit} disabled=${!text.trim()}>Save</button>
      <button class="btn-plain" onClick=${requestClose}>Cancel</button>
      <${TagPicker} tag=${tag} onTag=${setTag} />
    </div>
  </div>`;
}
