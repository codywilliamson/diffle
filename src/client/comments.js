// saved comment cards + threads. file-level and line-level share the same ui. a card reveals
// with the panel reveal (07) whenever it (re)appears — first save, or the return from an edit —
// and once settled its transition list belongs to the resolve / reopen / addressed tweens.
import { html, useState, useRef, useEffect } from "/preact.js";
import { relativeTime } from "/util.js";
import { useOpenClose, tokenMs } from "/motion.js";
import { SwapText } from "/textSwap.js";
import { CommentEditor } from "/commentEditor.js";
import { ReplyComposer } from "/replyComposer.js";
import { CommentReplies } from "/commentReplies.js";

export { CommentEditor, TAGS } from "/commentEditor.js";

const OPEN_TOKEN = "--editor-open-dur";
const RESOLVE_LABELS = ["Resolve", "Reopen"];
const noop = () => {};

// true once the reveal has played, so state changes tween on their own (quicker) clock
function useSettled(phase) {
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (phase !== "is-open") return;
    const timer = setTimeout(() => setSettled(true), tokenMs(OPEN_TOKEN));
    return () => clearTimeout(timer);
  }, [phase]);
  return settled;
}

// the read-only card: meta, tools, text, replies and the reply composer.
function CommentCard({ comment, onEdit, onDelete, onResolve, onReply }) {
  const [replying, setReplying] = useState(false);
  const replyButtonRef = useRef(null);
  // the parent unmounts the card on delete, so only the entrance phase is used
  const { phase } = useOpenClose(noop, OPEN_TOKEN);
  const settled = useSettled(phase);
  const closeReplying = () => {
    setReplying(false);
    replyButtonRef.current?.focus();
  };
  const status = comment.status ?? (comment.resolved ? "resolved" : "open");
  const resolved = status === "resolved";
  const cls = `comment-card ${resolved ? "resolved" : ""} status-${status} ${phase} ${settled ? "is-settled" : ""}`;
  return html`<div class=${cls}>
    <div class="comment-meta">
      <span class="comment-time">
        ${resolved && html`<span class="resolved-badge">Resolved</span>`}
        ${status === "addressed" && html`<span class="resolved-badge">Addressed</span>`}
        ${comment.tag && html`<span class="tag-pill tag-${comment.tag} on">${comment.tag}</span>`}
        ${relativeTime(comment.createdAt)}
      </span>
      <span class="comment-tools">
        <button class="btn-link" onClick=${() => onResolve(comment.id)}>
          <${SwapText} text=${resolved ? "Reopen" : "Resolve"} labels=${RESOLVE_LABELS} />
        </button>
        ${!resolved && html`<button class="btn-link" onClick=${onEdit}>Edit</button>`}
        ${onReply && !resolved && html`<button class="btn-link" ref=${replyButtonRef} onClick=${() => setReplying(true)}>Reply</button>`}
        <button class="btn-link" onClick=${() => onDelete(comment.id)}>Delete</button>
      </span>
    </div>
    <div class="comment-text">${comment.text}</div>
    ${comment.replies?.length > 0 && html`<${CommentReplies} replies=${comment.replies} />`}
    ${replying && !resolved &&
    html`<${ReplyComposer}
      onSend=${(text) => onReply(comment.id, text).then(closeReplying)}
      onCancel=${closeReplying}
    />`}
  </div>`;
}

// a single saved comment: the card, or the editor in its place while editing.
export function SavedComment({ comment, onEdit, onDelete, onResolve, onReply }) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return html`<${CommentEditor}
      initial=${comment.text}
      initialTag=${comment.tag}
      onSave=${(text, tag) => {
        onEdit(comment.id, text, tag);
        setEditing(false);
      }}
      onCancel=${() => setEditing(false)}
    />`;
  }
  return html`<${CommentCard}
    comment=${comment}
    onEdit=${() => setEditing(true)}
    onDelete=${onDelete}
    onResolve=${onResolve}
    onReply=${onReply}
  />`;
}

// a stack of comments for one anchor (a line or a file). threads stack vertically.
export function CommentThread({ comments, onEdit, onDelete, onResolve, onReply }) {
  return html`<div class="comment-thread">
    ${comments.map(
      (c) => html`<${SavedComment}
        key=${c.id}
        comment=${c}
        onEdit=${onEdit}
        onDelete=${onDelete}
        onResolve=${onResolve}
        onReply=${onReply}
      />`
    )}
  </div>`;
}
