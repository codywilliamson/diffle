<script lang="ts">
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import type { ReviewData } from "$lib/state/reviewRecord";
  import { getAppState } from "$lib/state/context";
  import { isRecord } from "$lib/state/reviewRecord";
  import { compile } from "$lib/api/meta";
  import { clickOutside } from "$lib/actions";
  import { scale } from "$lib/motion";

  const { review, comments, ui } = getAppState();

  let open = $state(false);
  let summary = $state("");
  let copied = $state<"" | "json" | "md">("");
  let trigger = $state<HTMLButtonElement>();

  const STATUS: Record<string, string> = { awaiting_human: "Ready", feedback_ready: "Feedback sent", approved: "Approved", cancelled: "Cancelled" };
  const record = $derived(review.record);
  const status = $derived(review.status);
  const unresolved = $derived(review.unresolvedCount);
  const terminal = $derived(status === "approved" || status === "cancelled");
  const awaiting = $derived(status === "awaiting_human");
  const canReturn = $derived(awaiting && (unresolved > 0 || summary.trim().length > 0));

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
  function close(): void {
    open = false;
    trigger?.focus();
  }
  async function act(kind: "feedback" | "approved" | "cancelled"): Promise<void> {
    if (kind === "approved" && unresolved && !confirm(`There are ${unresolved} unresolved comments. Approve anyway?`)) return;
    if (kind === "cancelled" && (unresolved > 0 || summary.trim()) && !confirm("Cancel this review? Open comments and your summary stay on the record but the review closes without approval.")) return;
    if (kind === "feedback") await review.returnFeedback(summary || undefined);
    else if (kind === "approved") await review.approve(unresolved > 0);
    else await review.cancel(summary || undefined);
    if (!review.error) {
      summary = "";
      close();
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

{#if isRecord(record)}
  <div class="relative">
    <button
      bind:this={trigger}
      type="button"
      class="flex items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-1 text-sm hover:bg-surface-2"
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-label="Review menu — {STATUS[status ?? '']}{unresolved ? `, ${unresolved} unresolved` : ''}"
      onclick={() => (open ? close() : (open = true))}
    >
      <span class="text-muted">Review</span>
      <span class="rounded px-1.5 text-xs status-{status}">{STATUS[status ?? ""]}</span>
      {#if !terminal && unresolved}<span class="rounded-full bg-accent px-1.5 text-xs text-primary-foreground">{unresolved}</span>{/if}
      <ChevronDown size={14} class="text-dim" />
    </button>

    {#if open}
      <div
        class="absolute right-0 z-40 mt-1 w-80 rounded-lg border border-border bg-surface p-3 shadow-xl"
        role="dialog"
        aria-label="Review outcome"
        tabindex="-1"
        style="transform-origin: top right"
        transition:scale={{ start: 0.96 }}
        use:clickOutside={close}
        onkeydown={(e) => { if (e.key === "Escape") { e.stopPropagation(); close(); } }}
      >
        <div class="mb-1 text-sm font-medium status-{status}">{STATUS[status ?? ""]}</div>
        <p class="mb-2 text-xs text-muted">{guidance()}</p>
        {#if agentUpdate(record)}
          <div class="mb-2 rounded border border-border bg-surface-2 p-2 text-xs">
            <strong class="text-text">Agent update</strong>
            <p class="text-muted">{agentUpdate(record)}</p>
          </div>
        {/if}
        <textarea
          bind:value={summary}
          disabled={terminal || !awaiting}
          placeholder="Optional reviewer summary"
          aria-label="Reviewer summary"
          class="mb-2 min-h-[3rem] w-full resize-none rounded-md border border-border bg-surface-2 p-2 text-sm text-text outline-none placeholder:text-dim focus:border-focus disabled:opacity-50"
        ></textarea>
        <div class="flex gap-2">
          <button class="rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground disabled:opacity-40" onclick={() => act("feedback")} disabled={!canReturn}>Return Feedback</button>
          <button class="rounded border border-border px-2 py-1 text-xs text-text hover:bg-surface-2 disabled:opacity-40" onclick={() => act("approved")} disabled={!awaiting}>Approve</button>
          <button class="rounded border border-border px-2 py-1 text-xs text-text hover:bg-surface-2 disabled:opacity-40" onclick={() => act("cancelled")} disabled={terminal}>Cancel</button>
        </div>
        <div class="mt-2 flex gap-3 text-xs text-muted">
          <button class="hover:text-text" onclick={() => copyFeedback("json")}>{copied === "json" ? "Copied" : "Copy JSON"}</button>
          <button class="hover:text-text" onclick={() => copyFeedback("md")}>{copied === "md" ? "Copied" : "Copy Markdown"}</button>
          <button class="hover:text-text" onclick={() => { close(); ui.openFeedbackPreview(summary || undefined); }}>Preview feedback</button>
        </div>
        {#if review.error}<div class="mt-2 text-xs text-destructive">{review.error}</div>{/if}
      </div>
    {/if}
  </div>
{/if}
