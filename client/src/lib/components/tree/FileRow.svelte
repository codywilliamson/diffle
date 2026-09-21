<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import type { TreeFile } from "$lib/diff/tree";
  import { getAppState } from "$lib/state/context";
  import { changeBadge } from "$lib/format";

  let { file, depth = 0 }: { file: TreeFile; depth?: number } = $props();
  const { ui, comments } = getAppState();

  const badge = $derived(changeBadge(file.changeType));
  const active = $derived(ui.activeFile === file.path);
  const viewed = $derived(comments.viewedSet.has(file.path));
  const count = $derived(comments.countFor(file.path));
</script>

<div class="flex items-center gap-1 pr-1.5" style="padding-left: {depth * 12 + 6}px">
  <button
    type="button"
    class="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1 text-left text-sm hover:bg-surface-2 {active ? 'bg-surface-2 text-text' : 'text-muted'}"
    aria-current={active ? "true" : undefined}
    onclick={() => ui.selectFile(file.path)}
  >
    <span class="grid size-4 shrink-0 place-items-center rounded font-mono text-[10px] font-semibold {badge.cls}" title={badge.label}>{badge.letter}</span>
    <span class="truncate font-mono">{file.name}</span>
    <span class="ml-auto flex shrink-0 items-center gap-1.5">
      {#if count > 0}
        <span class="rounded-full bg-surface-2 px-1.5 font-mono text-[10px] text-accent" title="{count} unresolved">{count}</span>
      {/if}
      {#if !file.binary && (file.additions || file.deletions)}
        <span class="font-mono text-[10px]">
          {#if file.additions}<span class="text-add-text">+{file.additions}</span>{/if}
          {#if file.deletions}<span class="text-del-text"> −{file.deletions}</span>{/if}
        </span>
      {/if}
    </span>
  </button>
  <label class="shrink-0 cursor-pointer rounded p-1 {viewed ? 'text-add-text' : 'text-dim hover:text-muted'}" title={viewed ? "Viewed" : "Mark viewed"}>
    <input type="checkbox" class="sr-only" checked={viewed} onchange={() => comments.toggleViewed(file.path)} aria-label="Mark {file.path} viewed" />
    <Check size={14} />
  </label>
</div>
