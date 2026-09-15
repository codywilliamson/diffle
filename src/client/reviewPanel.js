import { html, useState, useRef, useEffect, useCallback } from "/preact.js";
import { compile, submitReviewOutcome } from "/api.js";
import { ChevronDown } from "/icons.js";
import { useDismissablePopover } from "/popover.js";
import { Popover } from "/popoverSurface.js";
import { SwapText } from "/textSwap.js";
import { OpenBadge } from "/reviewBadge.js";

function unresolved(record) { return (record?.comments ?? []).filter((c) => (c.status ?? (c.resolved ? "resolved" : "open")) !== "resolved"); }
function latestAgentUpdate(record) { return record?.activity?.findLast((item) => item.type === "rereview_requested" && item.actor === "agent" && item.summary)?.summary ?? ""; }
const STATUS_LABELS = { awaiting_human: "Ready", feedback_ready: "Feedback sent", approved: "Approved", cancelled: "Cancelled" };
const JSON_LABELS = ["Copy JSON", "Copied"];
const MD_LABELS = ["Copy Markdown", "Copied"];
async function copy(text) {
  await navigator.clipboard.writeText(text);
}
function guidance(record, open) {
  if (record.status === "approved") return "Review complete. The change is approved.";
  if (record.status === "cancelled") return "Review closed without approval.";
  if (record.status === "feedback_ready") return record.origin?.agent
    ? "Return to the agent and say “continue” so it can retrieve this feedback."
    : "Paste the copied feedback into the conversation that produced this change.";
  if (!open) return "Add a comment or write a summary to return feedback, or approve the change.";
  return record.origin?.agent
    ? `${open} unresolved comment${open === 1 ? "" : "s"}. Return Feedback makes them available to the connected agent.`
    : `${open} unresolved comment${open === 1 ? "" : "s"}. Copy for a manual workflow, or record the outcome with Return Feedback.`;
}
export function ReviewPanel({ reviewId, record, refreshRecord, comments }) {
  const [isOpen, setIsOpen] = useState(false);
  const [summary, setSummary] = useState("");
  const [error, setError] = useState(""); const [copied, setCopied] = useState("");
  const panelRef = useRef(null); const triggerRef = useRef(null); const popoverRef = useRef(null);
  const closeRef = useRef(null); // the popover's animated close, once it is mounted

  // close plays the popover's exit and hands focus back; it unmounts once the exit has finished
  const close = () => { closeRef.current?.(); triggerRef.current?.focus(); };
  const onClosed = useCallback(() => setIsOpen(false), []);

  useDismissablePopover({ isOpen, close, panelRef });

  // move focus into the popover on open
  useEffect(() => { if (isOpen) popoverRef.current?.focus(); }, [isOpen]);

  if (!reviewId || !record) return null;
  const live = { ...record, comments }; const open = unresolved(live).length;
  const terminal = record.status === "approved" || record.status === "cancelled"; const agentUpdate = latestAgentUpdate(record);
  const awaiting = record.status === "awaiting_human"; const canReturn = awaiting && (open > 0 || summary.trim().length > 0);
  const act = async (outcome) => {
    if (outcome === "approved" && open && !window.confirm(`There are ${open} unresolved comments. Approve anyway?`)) return;
    if (outcome === "cancelled" && (open > 0 || summary.trim().length > 0) &&
      !window.confirm("Cancel this review? Open comments and your summary stay on the record but the review closes without approval.")) return;
    try {
      await submitReviewOutcome(reviewId, outcome, summary, outcome === "approved" && open > 0);
      setSummary(""); refreshRecord(); close();
    } catch (e) { setError(String(e)); }
  };
  const copyFeedback = async (format) => { try { const value = format === "json" ? JSON.stringify({ reviewId, target: record.target, summary, comments: unresolved(live) }, null, 2) : (await compile(summary)).prompt; await copy(value); setCopied(format); setTimeout(() => setCopied(""), 1500); } catch (e) { setError(String(e)); } };

  const statusLabel = STATUS_LABELS[record.status];
  const triggerLabel = `Review menu — ${statusLabel}${open ? `, ${open} unresolved comment${open === 1 ? "" : "s"}` : ""}`;

  return html`<div class="review-panel" ref=${panelRef}>
    <button type="button" class="review-trigger" ref=${triggerRef} aria-haspopup="dialog" aria-expanded=${isOpen}
      aria-controls="review-popover" aria-label=${triggerLabel} onClick=${() => (isOpen ? close() : setIsOpen(true))}>
      <span class="review-trigger-label">Review</span>
      <span class="review-status status-${record.status}"><${SwapText} text=${statusLabel} /></span>
      <${OpenBadge} count=${terminal ? 0 : open} />
      <${ChevronDown} />
    </button>
    ${isOpen && html`<${Popover} id="review-popover" class="review-popover" origin="top-right" role="dialog" aria-label="Review outcome" tabindex="-1"
      surfaceRef=${popoverRef} onClosed=${onClosed} closeRef=${closeRef}>
      <span class="review-status review-status-lg status-${record.status}">${statusLabel}</span>
      <p class="review-guidance">${guidance(record, open)}</p>
      ${agentUpdate && html`<div class="agent-update"><strong>Agent update</strong><p>${agentUpdate}</p></div>`}
      <textarea class="review-summary" value=${summary} disabled=${terminal || !awaiting}
        onInput=${(e) => setSummary(e.target.value)} placeholder="Optional reviewer summary"></textarea>
      <div class="review-actions">
        <button class="btn-primary" onClick=${() => act("feedback")} disabled=${!canReturn}>Return Feedback</button>
        <button class="btn-plain" onClick=${() => act("approved")} disabled=${!awaiting}>Approve</button>
        <button class="btn-plain" onClick=${() => act("cancelled")} disabled=${terminal}>Cancel</button>
      </div>
      <div class="review-exports">
        <button class="btn-link" onClick=${() => copyFeedback("json")}><${SwapText} text=${copied === "json" ? "Copied" : "Copy JSON"} labels=${JSON_LABELS} /></button>
        <button class="btn-link" onClick=${() => copyFeedback("md")}><${SwapText} text=${copied === "md" ? "Copied" : "Copy Markdown"} labels=${MD_LABELS} /></button>
      </div>
      ${error && html`<div class="review-warning">${error}</div>`}
    <//>`}
  </div>`;
}
