<script lang="ts">
  import ArrowUpToLine from "@lucide/svelte/icons/arrow-up-to-line";
  import ArrowDownToLine from "@lucide/svelte/icons/arrow-down-to-line";
  import UnfoldVertical from "@lucide/svelte/icons/unfold-vertical";
  import { EXPAND_STEP, linesLabel, type GapView, type RevealHow } from "$lib/diff/expand";

  // the controls on a hunk separator: grow the hunk above down, the hunk below up, or show it all.
  let { view, onReveal }: { view: GapView; onReveal: (how: RevealHow) => void } = $props();
  const stepped = $derived(view.hidden > EXPAND_STEP);
</script>

<span class="gap-expander">
  {#if stepped && view.canDown}
    <button type="button" class="gap-btn" title="Show {EXPAND_STEP} more lines below the code above" aria-label="Show {EXPAND_STEP} more lines below" onclick={() => onReveal("down")}><ArrowDownToLine size={12} aria-hidden="true" /></button>
  {/if}
  {#if stepped && view.canUp}
    <button type="button" class="gap-btn" title="Show {EXPAND_STEP} more lines above the code below" aria-label="Show {EXPAND_STEP} more lines above" onclick={() => onReveal("up")}><ArrowUpToLine size={12} aria-hidden="true" /></button>
  {/if}
  <button type="button" class="gap-btn" title="Show all {linesLabel(view.hidden, 'hidden')}" aria-label="Show all {linesLabel(view.hidden, 'hidden')}" onclick={() => onReveal("all")}><UnfoldVertical size={12} aria-hidden="true" /></button>
</span>
