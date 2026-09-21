<script lang="ts">
  import X from "@lucide/svelte/icons/x";
  import { getAppState } from "$lib/state/context";
  import { buildTree } from "$lib/diff/tree";
  import Folder from "./tree/Folder.svelte";
  import FileRow from "./tree/FileRow.svelte";

  const { diff, ui, prefs, comments } = getAppState();
  let filter = $state("");

  const shown = $derived.by(() => {
    const needle = filter.trim().toLowerCase();
    return needle ? diff.files.filter((f) => f.path.toLowerCase().includes(needle)) : diff.files;
  });
  const root = $derived(buildTree(shown));
  const viewedCount = $derived(diff.files.filter((f) => comments.viewedSet.has(f.path)).length);
  const total = $derived(diff.files.length);
  const pct = $derived(total ? Math.round((viewedCount / total) * 100) : 0);
</script>

<nav
  class="shrink-0 flex-col border-r border-border bg-surface {ui.drawerOpen ? 'fixed inset-y-0 left-0 z-30 flex w-72 shadow-xl' : 'hidden lg:flex'}"
  style={ui.drawerOpen ? "" : `width:${prefs.sidebarWidth}px`}
  aria-label="Changed files"
>
  <div class="flex items-center gap-2 border-b border-divider p-2 lg:hidden">
    <strong class="font-serif text-sm">Files</strong>
    <button class="ml-auto rounded p-1 text-muted hover:bg-surface-2" aria-label="Close file browser" onclick={() => ui.closeDrawer()}><X size={16} /></button>
  </div>

  <div class="flex flex-col gap-2 p-2">
    <input
      type="search"
      class="w-full rounded-md border border-border bg-surface-2 px-2 py-1 text-sm text-text placeholder:text-dim focus:border-focus"
      aria-label="Filter changed files"
      placeholder="Filter files…"
      bind:value={filter}
    />
    <div class="flex items-center gap-2" title="{viewedCount} of {total} files viewed">
      <div class="h-1 flex-1 overflow-hidden rounded-full bg-surface-2">
        <div class="h-full rounded-full bg-accent transition-[width] duration-200" style="width:{pct}%"></div>
      </div>
      <span class="shrink-0 font-mono text-[10px] text-dim">{viewedCount}/{total} viewed</span>
    </div>
  </div>

  <div class="min-h-0 flex-1 overflow-auto pb-2">
    {#if shown.length === 0}
      <div class="px-3 py-4 text-sm text-dim">No files match “{filter}”</div>
    {:else}
      {#each [...root.dirs.values()] as dir (dir.path)}
        <Folder node={dir} depth={0} />
      {/each}
      {#each root.files as file (file.path)}
        <FileRow {file} depth={0} />
      {/each}
    {/if}
  </div>
</nav>
