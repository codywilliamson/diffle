<script lang="ts">
  import type { ReviewData } from "$lib/state/reviewRecord";
  import { getAppState } from "$lib/state/context";
  import { isRecord } from "$lib/state/reviewRecord";
  import { compile } from "$lib/api/meta";
  import Markdown from "../Markdown.svelte";

  // the review outcome form: guidance, the agent's latest update, the reviewer summary and the
  // outcome actions. shared by the review menu popover and its expanded modal.
  let { summary = $bindable(), expanded = false, onDone }: { summary: string; expanded?: boolean; onDone: () => void } = $props();
  const { review, comments, ui } = getAppState();

  let copied = $state<"" | "json" | "md">("");

  const record = $derived(review.record);
  const status = $derived(review.status);
  const unresolved = $derived(review.unresolvedCount);
  const terminal = $derived(status === "approved" || status === "cancelled");
  const awaiting = $derived(status === "awaiting_human");
  const canReturn = $derived(awaiting && (unresolved > 0 || summary.trim().length > 0));
  const update = $derived(agentUpdate(record));

  function agentUpdate(rec: ReviewData | null): string {
    if (!isRecord(rec)) return "";
    return [...rec.activity].reverse().find((a) => a.type === "rereview_requested" && a.actor === "agent" && a.summary)?.summary ?? "";
  }
  function guidance(): string {
    if (status === "approved") return "Review complete. The change is approved.";
    if (status === "cancelled") return "Review closed without approval.";
    const agent = isRecord(record) && record.origin?.agent;
    if (status === "feedback_ready") return agent ? "Return to the agent and say “continue” so it can retrieve this feedback." : "Paste the copied feedback into the conversation that produced this change.";
    if (!unresolved) return "Add a comment or write a summary to return feedback, or approve the change.";
    return agent ? `${unresolved} unresolved — Return Feedback makes them available to the agent.` : `${unresolved} unresolved — copy for a manual workflow, or record the outcome with Return Feedback.`;
  }
  async function act(kind: "feedback" | "approved" | "cancelled"): Promise<void> {
    if (kind === "approved" && unresolved && !confirm(`There are ${unresolved} unresolved comments. Approve anyway?`)) return;
    if (kind === "cancelled" && (unresolved > 0 || summary.trim()) && !confirm("Cancel this review? Open comments and your summary stay on the record but the review closes without approval.")) return;
    if (kind === "feedback") await review.returnFeedback(summary || undefined);
    else if (kind === "approved") await review.approve(unresolved > 0);
    else await review.cancel(summary || undefined);
    if (!review.error) {
      summary = "";
      onDone();
    }
  }
  async function copyFeedback(format: "json" | "md"): Promise<void> {
    const value =
      format === "json"
        ? JSON.stringify({ reviewId: review.reviewId, target: isRecord(record) ? record.target : undefined, summary, comments: comments.comments.filter((c) => (c.status ?? (c.resolved ? "resolved" : "open")) !== "resolved") }, null, 2)
        : (await compile(summary || undefined)).prompt;
    await navigator.clipboard.writeText(value);
    copied = format;
    setTimeout(() => (copied = ""), 1500);
  }
</script>

<p class="mb-2 text-xs text-muted">{guidance()}</p>
{#if update}
  <div class="mb-2 rounded border border-border bg-surface-2 p-2 {expanded ? 'text-sm' : 'max-h-48 overflow-auto text-xs'}">
    <strong class="text-text">Agent update</strong>
    <Markdown text={update} class="mt-1" />
  </div>
{/if}
<textarea
  bind:value={summary}
  disabled={terminal || !awaiting}
  placeholder="Optional reviewer summary"
  aria-label="Reviewer summary"
  class="mb-2 max-h-[60vh] w-full resize-y rounded-md border border-border bg-surface-2 p-2 text-sm text-text outline-none placeholder:text-dim focus:border-focus disabled:opacity-50 {expanded ? 'min-h-[10rem]' : 'min-h-[3rem]'}"
></textarea>
<div class="flex gap-2">
  <button class="rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground disabled:opacity-40" onclick={() => act("feedback")} disabled={!canReturn}>Return Feedback</button>
  <button class="rounded border border-border px-2 py-1 text-xs text-text hover:bg-surface-2 disabled:opacity-40" onclick={() => act("approved")} disabled={!awaiting}>Approve</button>
  <button class="rounded border border-border px-2 py-1 text-xs text-text hover:bg-surface-2 disabled:opacity-40" onclick={() => act("cancelled")} disabled={terminal}>Cancel</button>
</div>
<div class="mt-2 flex gap-3 text-xs text-muted">
  <button class="hover:text-text" onclick={() => copyFeedback("json")}>{copied === "json" ? "Copied" : "Copy JSON"}</button>
  <button class="hover:text-text" onclick={() => copyFeedback("md")}>{copied === "md" ? "Copied" : "Copy Markdown"}</button>
  <button class="hover:text-text" onclick={() => { onDone(); ui.openFeedbackPreview(summary || undefined); }}>Preview feedback</button>
</div>
{#if review.error}<div class="mt-2 text-xs text-destructive">{review.error}</div>{/if}
