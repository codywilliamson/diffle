<script lang="ts">
  import type { FileAnalysis } from "$types";
  import FlagList from "./FlagList.svelte";

  let { file, onPick }: { file: FileAnalysis; onPick: () => void } = $props();
</script>

<li class="border-b border-divider py-2 last:border-b-0">
  <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
    <button type="button" class="min-w-0 break-all text-left font-mono text-sm text-text hover:text-accent hover:underline" onclick={onPick}>{file.path}</button>
    {#if file.churn > 0}
      <span class="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-muted" title="commits touching this file recently">{file.churn} recent {file.churn === 1 ? "commit" : "commits"}</span>
    {/if}
    {#if file.changedSinceReview === true}
      <span class="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-accent">Changed since last review</span>
    {/if}
  </div>
  {#if file.flags.length}<FlagList flags={file.flags} {onPick} />{/if}
</li>
