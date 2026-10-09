<script lang="ts">
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import type { ScorecardCategory } from "$types";
  import BandBadge from "./BandBadge.svelte";

  let { category }: { category: ScorecardCategory } = $props();
  const expandable = $derived(category.reasons.length > 0);
</script>

<li class="scorecard-category border-b border-divider last:border-b-0">
  {#if expandable}
    <details class="group">
      <summary class="flex cursor-pointer list-none items-start gap-2 py-2.5 [&::-webkit-details-marker]:hidden">
        <ChevronRight size={14} class="mt-1 shrink-0 text-dim transition-transform group-open:rotate-90" />
        <BandBadge band={category.band} />
        <span class="min-w-0">
          <span class="block text-sm font-medium text-text">{category.label}</span>
          <span class="block text-sm text-muted">{category.summary}</span>
        </span>
      </summary>
      <ul class="mb-2.5 ml-6 list-disc space-y-1 pl-5 text-sm text-muted">
        {#each category.reasons as reason}<li>{reason}</li>{/each}
      </ul>
    </details>
  {:else}
    <div class="flex items-start gap-2 py-2.5 pl-[22px]">
      <BandBadge band={category.band} />
      <span class="min-w-0">
        <span class="block text-sm font-medium text-text">{category.label}</span>
        <span class="block text-sm text-muted">{category.summary}</span>
      </span>
    </div>
  {/if}
</li>
