<script lang="ts">
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import type { DiffFile } from "$types";
  import { changeBadge } from "$lib/format";
  import { fileAnchorId } from "$lib/diff/tree";
  import UnifiedDiff from "./UnifiedDiff.svelte";

  let { file }: { file: DiffFile } = $props();
  let collapsed = $state(false);
  const badge = $derived(changeBadge(file.changeType));
</script>

<section id={fileAnchorId(file.path)} class="mb-4 overflow-hidden rounded-lg border border-border bg-surface">
  <header class="sticky top-0 z-10 flex items-center gap-2 border-b border-divider bg-surface-2 px-3 py-2">
    <button
      type="button"
      class="rounded p-0.5 text-muted hover:text-text"
      aria-expanded={!collapsed}
      aria-label={collapsed ? `Expand ${file.path}` : `Collapse ${file.path}`}
      onclick={() => (collapsed = !collapsed)}
    >
      <ChevronDown size={15} class="transition-transform duration-150 {collapsed ? '-rotate-90' : ''}" />
    </button>
    <span class="grid size-4 shrink-0 place-items-center rounded font-mono text-[10px] font-semibold {badge.cls}" title={badge.label}>{badge.letter}</span>
    <span class="truncate font-mono text-sm text-text">{file.path}</span>
    {#if file.oldPath && file.oldPath !== file.path}
      <span class="truncate font-mono text-xs text-dim">← {file.oldPath}</span>
    {/if}
    <span class="ml-auto flex shrink-0 items-center gap-2 font-mono text-xs">
      {#if file.additions}<span class="text-add-text">+{file.additions}</span>{/if}
      {#if file.deletions}<span class="text-del-text">−{file.deletions}</span>{/if}
    </span>
  </header>

  {#if !collapsed}
    {#if file.binary}
      <p class="px-4 py-3 text-sm text-muted">Binary file — no textual diff.</p>
    {:else if file.hunks.length === 0}
      <p class="px-4 py-3 text-sm text-dim">No changes to display.</p>
    {:else}
      <div class="overflow-x-auto"><UnifiedDiff {file} /></div>
    {/if}
  {/if}
</section>
