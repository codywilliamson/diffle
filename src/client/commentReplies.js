// reply thread under a comment: replies rise in staggered with the texts reveal (18). each reply
// keeps the stagger step it was given when it first appeared, so a batch arriving later (a live
// agent reply) cascades from step 0 instead of queueing behind everything already on screen.
import { html, useRef } from "/preact.js";
import { useOpenClose } from "/motion.js";
import { relativeTime } from "/util.js";

// only the entrance phase is used — replies leave with their card
const CLOSE_TOKEN = "--stagger-dur";
const noop = () => {};
// caps the cascade so a long thread still settles within roughly a third of a second
const MAX_STAGGER_STEPS = 3;

// stored author -> reader-facing label.
const replyAuthorLabel = (author) => (author === "agent" ? "Agent" : "You");

// stagger step per reply id, assigned on first sight and kept for the reply's lifetime
function useStaggerSteps(replies) {
  const steps = useRef(new Map());
  let fresh = 0;
  for (const reply of replies) {
    if (!steps.current.has(reply.id)) steps.current.set(reply.id, Math.min(fresh++, MAX_STAGGER_STEPS));
  }
  return steps.current;
}

function Reply({ reply, step }) {
  const { phase } = useOpenClose(noop, CLOSE_TOKEN);
  return html`<div
    class="comment-reply reply-${reply.author} ${phase}"
    style="transition-delay: calc(var(--stagger-stagger) * ${step})"
  >
    <span class="reply-meta">
      <span class="reply-author">${replyAuthorLabel(reply.author)}</span>
      <span class="reply-time">${relativeTime(reply.createdAt)}</span>
    </span>
    <span class="reply-text">${reply.text}</span>
  </div>`;
}

export function CommentReplies({ replies }) {
  const steps = useStaggerSteps(replies);
  return html`<div class="comment-replies">
    ${replies.map((reply) => html`<${Reply} key=${reply.id} reply=${reply} step=${steps.get(reply.id)} />`)}
  </div>`;
}
