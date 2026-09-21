<script lang="ts">
  import PanelLeft from "@lucide/svelte/icons/panel-left";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import Moon from "@lucide/svelte/icons/moon";
  import Sun from "@lucide/svelte/icons/sun";
  import { getAppState } from "$lib/state/context";

  const { diff, prefs, ui } = getAppState();

  const fileCount = $derived(`${diff.files.length} ${diff.files.length === 1 ? "file" : "files"}`);
  const delta = $derived.by(() => {
    let add = 0;
    let del = 0;
    for (const f of diff.files) {
      add += f.additions;
      del += f.deletions;
    }
    return { add, del };
  });
</script>

<header class="flex items-center gap-3 border-b border-divider bg-surface px-3 py-2">
  <button class="rounded p-1.5 text-muted hover:bg-surface-2 lg:hidden" aria-label="Toggle file list" onclick={() => ui.openDrawer()}>
    <PanelLeft size={16} />
  </button>

  <span class="font-serif text-lg leading-none tracking-[-0.04em] text-accent">diffle</span>

  {#if diff.meta}
    <span class="hidden font-mono text-xs text-muted sm:inline">{diff.meta.repo}</span>
    <span class="hidden rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted sm:inline">{diff.meta.mode}</span>
  {/if}

  <span class="truncate font-mono text-sm text-muted">{diff.ref}</span>

  <span class="ml-auto flex shrink-0 items-center gap-2 font-mono text-xs">
    <span class="text-dim">{fileCount}</span>
    <span class="text-add-text">+{delta.add}</span>
    <span class="text-del-text">−{delta.del}</span>
  </span>

  <div class="flex shrink-0 items-center gap-0.5">
    <button class="rounded p-1.5 text-muted hover:bg-surface-2 hover:text-text" aria-label="Re-run the diff" title="Re-run the diff" onclick={() => diff.refresh()}>
      <RefreshCw size={16} />
    </button>
    <button
      class="rounded p-1.5 text-muted hover:bg-surface-2 hover:text-text"
      aria-label="Theme: {prefs.theme} — switch"
      title="Toggle theme"
      onclick={() => prefs.toggleTheme()}
    >
      {#if prefs.theme === "dark"}<Sun size={16} />{:else}<Moon size={16} />{/if}
    </button>
  </div>
</header>
