<script lang="ts">
  import PanelLeft from "@lucide/svelte/icons/panel-left";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import Moon from "@lucide/svelte/icons/moon";
  import Sun from "@lucide/svelte/icons/sun";
  import Columns2 from "@lucide/svelte/icons/columns-2";
  import WrapText from "@lucide/svelte/icons/wrap-text";
  import Rows3 from "@lucide/svelte/icons/rows-3";
  import Sparkles from "@lucide/svelte/icons/sparkles";
  import CircleHelp from "@lucide/svelte/icons/circle-help";
  import { getAppState } from "$lib/state/context";
  import { withViewTransition } from "$lib/viewTransition";
  import OverflowMenu from "./OverflowMenu.svelte";
  import ReviewPanel from "./review/ReviewPanel.svelte";
  import UpdateBadge from "./UpdateBadge.svelte";

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

<header class="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-divider bg-surface px-3 py-2 min-[701px]:flex-nowrap">
  <button class="rounded p-1.5 text-muted hover:bg-surface-2 lg:hidden" aria-label="Toggle file list" onclick={() => ui.openDrawer()}>
    <PanelLeft size={16} />
  </button>

  <span class="font-serif text-lg leading-none tracking-[-0.04em] text-accent">diffle</span>

  {#if diff.meta}
    <span class="hidden font-mono text-xs text-muted sm:inline">{diff.meta.repo}</span>
    <span class="hidden rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted sm:inline">{diff.meta.mode}</span>
  {/if}

  <span class="min-w-0 flex-1 truncate font-mono text-sm text-muted">{diff.ref}</span>

  <span class="ml-auto hidden shrink-0 items-center gap-2 font-mono text-xs min-[701px]:flex">
    <span class="text-dim">{fileCount}</span>
    <span class="text-add-text">+{delta.add}</span>
    <span class="text-del-text">−{delta.del}</span>
  </span>

  <div class="flex w-full shrink-0 items-center justify-end gap-1 min-[701px]:w-auto">
    <UpdateBadge />
    <ReviewPanel />
    <OverflowMenu
      fileView={prefs.fileView}
      split={prefs.split}
      wrap={prefs.wrap}
      onRefresh={() => diff.refresh()}
      onToggleFileView={() => prefs.setFileView(prefs.fileView === "single" ? "all" : "single")}
      onToggleSplit={() => prefs.toggleSplit()}
      onToggleWrap={() => prefs.toggleWrap()}
      onToggleTheme={() => withViewTransition(() => prefs.toggleTheme())}
      onWhatsNew={() => ui.toggleOverlay("whatsNew")}
      onHelp={() => ui.toggleOverlay("help")}
    />
    <div class="hidden items-center gap-1 min-[701px]:flex">
      <button
        class="rounded p-1.5 hover:bg-surface-2 {prefs.fileView === 'single' ? 'bg-surface-2 text-accent' : 'text-muted hover:text-text'}"
        aria-label="Single-file view"
        aria-pressed={prefs.fileView === "single"}
        title="Single-file view (o)"
        onclick={() => prefs.setFileView(prefs.fileView === "single" ? "all" : "single")}
      >
        <Rows3 size={16} />
      </button>
      <button
        class="rounded p-1.5 hover:bg-surface-2 {prefs.split ? 'bg-surface-2 text-accent' : 'text-muted hover:text-text'}"
        aria-label="Side-by-side view"
        aria-pressed={prefs.split}
        title="Side-by-side view (s)"
        onclick={() => prefs.toggleSplit()}
      >
        <Columns2 size={16} />
      </button>
      <button
        class="rounded p-1.5 hover:bg-surface-2 {prefs.wrap ? 'bg-surface-2 text-accent' : 'text-muted hover:text-text'}"
        aria-label="Wrap lines"
        aria-pressed={prefs.wrap}
        title="Wrap lines (w)"
        onclick={() => prefs.toggleWrap()}
      >
        <WrapText size={16} />
      </button>
      <button class="rounded p-1.5 text-muted hover:bg-surface-2 hover:text-text" aria-label="Re-run the diff" title="Re-run the diff (r)" onclick={() => diff.refresh()}>
        <RefreshCw size={16} class={diff.refreshing ? "animate-spin" : ""} />
      </button>
      <button
        class="rounded p-1.5 text-muted hover:bg-surface-2 hover:text-text"
        aria-label="Theme: {prefs.theme} — switch"
        title="Toggle theme (t)"
        onclick={() => withViewTransition(() => prefs.toggleTheme())}
      >
        {#if prefs.theme === "dark"}<Sun size={16} />{:else}<Moon size={16} />{/if}
      </button>
      <button class="rounded p-1.5 text-muted hover:bg-surface-2 hover:text-text" aria-label="What's new" title="What's new (n)" onclick={() => ui.toggleOverlay("whatsNew")}>
        <Sparkles size={16} />
      </button>
      <button class="rounded p-1.5 text-muted hover:bg-surface-2 hover:text-text" aria-label="Keyboard shortcuts" title="Keyboard shortcuts (?)" onclick={() => ui.toggleOverlay("help")}>
        <CircleHelp size={16} />
      </button>
    </div>
  </div>
</header>
