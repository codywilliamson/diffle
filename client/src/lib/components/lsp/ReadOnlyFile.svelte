<script lang="ts">
  import Lock from "@lucide/svelte/icons/lock";
  import X from "@lucide/svelte/icons/x";
  import { tick } from "svelte";
  import { getAppState } from "$lib/state/context";
  import { escapeHtml } from "$lib/diff/html";
  import { highlightText } from "$lib/lsp/highlightCode";
  import { windowAround, VIEWER_WINDOW_LINES } from "$lib/lsp/viewerWindow";

  // a navigation target the diff does not show: an unchanged repo file, an untouched part of a
  // changed file, or a file outside the repo (stdlib, node_modules). read-only, with the target
  // line highlighted. Esc closes it; Ctrl+o closes it and returns to where the jump started.
  const { lsp } = getAppState();
  const viewer = $derived(lsp.viewer);
  let panel: HTMLElement | undefined = $state();
  let body: HTMLDivElement | undefined = $state();
  let html = $state.raw<string[] | null>(null);

  const content = $derived(viewer?.status === "ready" ? viewer.content : null);
  const view = $derived(content === null || !viewer ? null : windowAround(content, viewer.target.line));
  const shownPath = $derived(viewer ? (viewer.target.path ?? viewer.target.absolutePath) : "");

  $effect(() => {
    const current = view;
    const path = viewer?.target.path ?? viewer?.target.absolutePath ?? "";
    html = null;
    if (!current) return;
    let live = true;
    highlightText(path, current.lines.join("\n"))
      .then((lines) => {
        if (live) html = lines;
      })
      .catch(() => {});
    return () => (live = false);
  });

  // once the lines exist, bring the target to the middle and take the keyboard
  $effect(() => {
    if (!view) return;
    void tick().then(() => {
      body?.querySelector("[data-target-line]")?.scrollIntoView({ block: "center" });
      panel?.focus();
    });
  });

  const SCROLL_STEP_PX = 40;
  function onKeydown(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey || !body) return;
    if (event.key === "j" || event.key === "ArrowDown") body.scrollBy({ top: SCROLL_STEP_PX });
    else if (event.key === "k" || event.key === "ArrowUp") body.scrollBy({ top: -SCROLL_STEP_PX });
    else if (event.key === "g") body.scrollTo({ top: 0 });
    else if (event.key === "G") body.scrollTo({ top: body.scrollHeight });
    else return;
    event.preventDefault();
  }
</script>

{#if viewer}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions (a scroll region: j and k scroll it) -->
  <section
    bind:this={panel}
    class="absolute inset-0 z-20 flex flex-col bg-bg outline-none"
    aria-label="Read-only file {shownPath}"
    tabindex="-1"
    data-lsp-panel
    data-lsp-viewer
    onkeydown={onKeydown}
  >
    <header class="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border bg-surface-2 px-4 py-2">
      <span class="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted"><Lock size={11} />read-only</span>
      <span class="min-w-0 truncate font-mono text-sm text-text" title={viewer.target.absolutePath} data-viewer-path>{shownPath}</span>
      {#if !viewer.target.inRepo}<span class="text-xs text-muted" data-outside-repo>outside the repository</span>{/if}
      <span class="font-mono text-xs text-dim">line {viewer.target.line}</span>
      <button type="button" class="ml-auto grid size-6 place-items-center rounded text-muted hover:text-text" aria-label="Close file" onclick={() => lsp.closeViewer()}><X size={14} /></button>
    </header>
    {#if viewer.status === "loading"}
      <p class="px-4 py-3 text-sm text-muted" role="status">Loading the file…</p>
    {:else if viewer.status === "error"}
      <p class="px-4 py-3 text-sm text-destructive" role="alert">{viewer.message}</p>
    {:else if view}
      <div bind:this={body} class="min-h-0 flex-1 overflow-auto py-2 font-mono text-[13px] leading-6" data-viewer-body>
        {#if view.first > 1}<p class="px-4 pb-1 text-xs text-dim">Lines 1 to {view.first - 1} are not shown ({VIEWER_WINDOW_LINES} lines around the target are).</p>{/if}
        {#each view.lines as text, i (i)}
          {@const number = view.first + i}
          {@const target = number === viewer.target.line}
          <div class="flex {target ? 'bg-surface-2 shadow-[inset_3px_0_0_var(--cursor)]' : ''}" data-line={number} data-target-line={target ? "" : undefined}>
            <span class="w-14 shrink-0 select-none pr-3 text-right text-dim">{number}</span>
            <span class="whitespace-pre pr-4 text-text">{@html html?.[i] ?? escapeHtml(text)}</span>
          </div>
        {/each}
        {#if view.last < view.total}<p class="px-4 pt-1 text-xs text-dim">Lines {view.last + 1} to {view.total} are not shown.</p>{/if}
      </div>
    {/if}
  </section>
{/if}
