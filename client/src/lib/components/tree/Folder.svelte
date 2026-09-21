<script lang="ts">
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import type { TreeNode } from "$lib/diff/tree";
  import Self from "./Folder.svelte";
  import FileRow from "./FileRow.svelte";
  import { slide } from "$lib/motion";

  let { node, depth = 0 }: { node: TreeNode; depth?: number } = $props();
  let open = $state(true);

  const subdirs = $derived([...node.dirs.values()]);
</script>

<div>
  <button
    type="button"
    class="flex w-full items-center gap-1 py-1 text-left text-xs font-medium text-muted hover:text-text"
    style="padding-left: {depth * 12 + 6}px"
    aria-expanded={open}
    onclick={() => (open = !open)}
  >
    <ChevronRight size={13} class="shrink-0 transition-transform duration-150 {open ? 'rotate-90' : ''}" />
    <span class="truncate font-mono">{node.name}</span>
  </button>
  {#if open}
    <div transition:slide>
      {#each subdirs as dir (dir.path)}
        <Self node={dir} depth={depth + 1} />
      {/each}
      {#each node.files as file (file.path)}
        <FileRow {file} depth={depth + 1} />
      {/each}
    </div>
  {/if}
</div>
