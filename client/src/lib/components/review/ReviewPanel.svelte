<script lang="ts">
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import Maximize from "@lucide/svelte/icons/maximize-2";
  import NumberFlow from "@number-flow/svelte";
  import { getAppState } from "$lib/state/context";
  import { isRecord } from "$lib/state/reviewRecord";
  import { clickOutside } from "$lib/actions";
  import { scale } from "$lib/motion";
  import Modal from "../Modal.svelte";
  import ReviewOutcome from "./ReviewOutcome.svelte";

  const { review } = getAppState();

  let open = $state(false);
  let expanded = $state(false);
  let summary = $state("");
  let trigger = $state<HTMLButtonElement>();

  const STATUS: Record<string, string> = { awaiting_human: "Ready", feedback_ready: "Feedback sent", approved: "Approved", cancelled: "Cancelled" };
  const status = $derived(review.status);
  const unresolved = $derived(review.unresolvedCount);
  const terminal = $derived(status === "approved" || status === "cancelled");

  function close(): void {
    open = false;
    expanded = false;
    trigger?.focus();
  }
  // the trigger sits outside the popover; let its own click toggle instead of close-then-reopen.
  function closeUnlessTrigger(e: MouseEvent): void {
    if (!trigger?.contains(e.target as Node)) close();
  }
  function expand(): void {
    open = false;
    expanded = true;
  }
</script>

{#if isRecord(review.record)}
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
      {#if !terminal && unresolved}<span class="rounded-full bg-accent px-1.5 text-xs text-primary-foreground"><NumberFlow value={unresolved} /></span>{/if}
      <ChevronDown size={14} class="text-dim" />
    </button>

    {#if open}
      <div
        class="absolute right-0 z-40 mt-1 w-[26rem] max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-surface p-3 shadow-xl"
        role="dialog"
        aria-label="Review outcome"
        tabindex="-1"
        style="transform-origin: top right"
        transition:scale={{ start: 0.96 }}
        use:clickOutside={closeUnlessTrigger}
        onkeydown={(e) => { if (e.key === "Escape") { e.stopPropagation(); close(); } }}
      >
        <div class="mb-1 flex items-center">
          <span class="text-sm font-medium status-{status}">{STATUS[status ?? ""]}</span>
          <button class="-mr-1 ml-auto rounded p-1 text-muted hover:bg-surface-2 hover:text-text" aria-label="Expand review" title="Expand" onclick={expand}><Maximize size={14} /></button>
        </div>
        <ReviewOutcome bind:summary onDone={close} />
      </div>
    {/if}
  </div>

  {#if expanded}
    <Modal title="Review — {STATUS[status ?? '']}" wide onClose={close}>
      <ReviewOutcome bind:summary expanded onDone={close} />
    </Modal>
  {/if}
{/if}
