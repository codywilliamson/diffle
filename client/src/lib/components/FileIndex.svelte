<script lang="ts">
  import X from "@lucide/svelte/icons/x";
  import { getAppState } from "$lib/state/context";
  import { buildTree, type TreeFile } from "$lib/diff/tree";
  import { useOrderedFiles } from "$lib/state/orderedFiles.svelte";
  import Folder from "./tree/Folder.svelte";
  import FileRow from "./tree/FileRow.svelte";
  import Resizer from "./Resizer.svelte";

  const { diff, ui, prefs, comments, analysis } = getAppState();
  const ordered = useOrderedFiles();
  let filter = $state("");

  // live width during a drag (in-memory, no localStorage); committed to prefs on release.
  let dragWidth = $state<number | null>(null);
  const width = $derived(dragWidth ?? prefs.sidebarWidth);
  const clampWidth = (x: number) => Math.round(Math.max(180, Math.min(640, x)));

  const shown = $derived.by(() => {
    const needle = filter.trim().toLowerCase();
    return needle ? diff.files.filter((f) => f.path.toLowerCase().includes(needle)) : diff.files;
  });
  const root = $derived(buildTree(shown));

  // review mode: the scorecard's groups, each with its files in suggested order, flat.
  const reviewMode = $derived(prefs.fileOrder === "review" && analysis.scorecard !== null);
  const reviewGroups = $derived.by(() => {
    const scorecard = analysis.scorecard;
    if (!scorecard) return [];
    const byPath = new Map(shown.map((f) => [f.path, f]));
    const placed = new Set<string>();
    const asRow = (f: (typeof shown)[number]): TreeFile => ({ ...f, name: f.path });
    const groups = scorecard.groups.map((g) => ({
      id: g.id,
      label: g.label,
      files: g.files.flatMap((path): TreeFile[] => {
        const f = byPath.get(path);
        if (!f || placed.has(path)) return [];
        placed.add(path);
        return [asRow(f)];
      }),
    }));
    const rest = ordered.files.filter((f) => byPath.has(f.path) && !placed.has(f.path)).map(asRow);
    return [...groups, { id: "other", label: "Other", files: rest }].filter((g) => g.files.length);
  });
  const viewedCount = $derived(diff.files.filter((f) => comments.viewedSet.has(f.path)).length);
  const total = $derived(diff.files.length);
  const pct = $derived(total ? Math.round((viewedCount / total) * 100) : 0);
</script>

<nav
  class="relative shrink-0 flex-col border-r border-border bg-surface {ui.drawerOpen ? 'fixed inset-y-0 left-0 z-30 flex w-72 shadow-xl' : 'hidden lg:flex'}"
  style={ui.drawerOpen ? "" : `width:${width}px`}
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
    <div class="flex rounded-md border border-border p-0.5 text-xs" role="group" aria-label="File order">
      {#each [["tree", "Tree"], ["review", "Review order"]] as const as [value, label]}
        <button
          type="button"
          class="flex-1 rounded px-2 py-0.5 {prefs.fileOrder === value ? 'bg-surface-2 text-text' : 'text-muted hover:text-text'}"
          aria-pressed={prefs.fileOrder === value}
          onclick={() => prefs.setFileOrder(value)}
        >{label}</button>
      {/each}
    </div>
    <div class="flex items-center gap-2" title="{viewedCount} of {total} files viewed">
      <div class="h-1 flex-1 overflow-hidden rounded-full bg-surface-2">
        <div class="h-full rounded-full bg-accent transition-[width] duration-200" style="width:{pct}%"></div>
      </div>
      <span class="shrink-0 font-mono text-[10px] text-dim">{viewedCount}/{total} viewed</span>
    </div>
  </div>

  <div class="relative min-h-0 flex-1 overflow-auto pb-2">
    {#if shown.length === 0}
      <div class="px-3 py-4 text-sm text-dim">No files match “{filter}”</div>
    {:else if reviewMode}
      {#each reviewGroups as group (group.id)}
        <div class="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-dim" data-review-group>{group.label}</div>
        {#each group.files as file (file.path)}
          <FileRow {file} review />
        {/each}
      {/each}
    {:else}
      {#each [...root.dirs.values()] as dir (dir.path)}
        <Folder node={dir} depth={0} />
      {/each}
      {#each root.files as file (file.path)}
        <FileRow {file} depth={0} />
      {/each}
    {/if}
  </div>

  {#if !ui.drawerOpen}
    <Resizer
      onResize={(x) => (dragWidth = clampWidth(x))}
      onCommit={() => {
        if (dragWidth != null) prefs.setSidebarWidth(dragWidth);
        dragWidth = null;
      }}
    />
  {/if}
</nav>
