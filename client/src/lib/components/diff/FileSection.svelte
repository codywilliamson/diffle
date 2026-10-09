<script lang="ts">
  import { untrack } from "svelte";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import MessagePlus from "@lucide/svelte/icons/message-square-plus";
  import type { CommentTag, DiffFile } from "$types";
  import { getAppState } from "$lib/state/context";
  import { changeBadge } from "$lib/format";
  import { fileAnchorId } from "$lib/diff/tree";
  import { fileComments, newComment } from "$lib/diff/threads";
  import { lineCountOf, estimatedHeight, GIANT_FILE_LINES } from "$lib/diff/metrics";
  import {
    canOverrideFileSplit,
    canPreviewMarkdown,
    createFileSplitState,
    resolveFileSplit,
    syncGlobalSplit,
    toggleFileSplit,
  } from "$lib/diff/fileMode";
  import { movedLookup } from "$lib/diff/movedLines";
  import { PLAIN_ANNOTATIONS, type DiffAnnotations } from "$lib/diff/annotations";
  import { createInterdiff } from "$lib/diff/interdiff.svelte";
  import { nearViewport } from "$lib/actions";
  import { revealRows } from "$lib/motion";
  import UnifiedDiff from "./UnifiedDiff.svelte";
  import SplitDiff from "./SplitDiff.svelte";
  import MarkdownPreview from "./MarkdownPreview.svelte";
  import FileFlags from "./FileFlags.svelte";
  import InterdiffToggle from "./InterdiffToggle.svelte";
  import CommentThread from "../comment/CommentThread.svelte";
  import CommentEditor from "../comment/CommentEditor.svelte";

  let { file }: { file: DiffFile } = $props();
  const { ui, comments, prefs, diff, analysis } = getAppState();
  const NOISE_LABEL = { generated: "Generated file", lockfile: "Lockfile" } as const;
  // deleted files collapse by default (github-style) — the removal is rarely re-read line by line.
  let collapsed = $state(untrack(() => file.changeType === "deleted"));
  let loaded = $state(false); // giant-file manual gate
  let mounted = $state(false); // near-viewport lazy mount
  let preview = $state(false); // markdown: rendered preview vs diff
  let touched = $state(false); // the reader has expanded/collapsed this file themselves
  let sinceReview = $state(false); // interdiff toggle (per-session ui state)
  let splitState = $state(untrack(() => createFileSplitState(prefs.split)));

  const fileAnalysis = $derived(analysis.fileFor(file.path));
  const noise = $derived(fileAnalysis?.noise ?? null);
  const changedSinceReview = $derived(fileAnalysis?.changedSinceReview === true);
  const interdiffOn = $derived(sinceReview && changedSinceReview);
  const interdiff = createInterdiff(() => ({ path: file.path, enabled: interdiffOn, version: file }));
  const interdiffState = $derived(interdiff.state);
  // the file the body renders: the full diff, or the interdiff once it has loaded.
  const shown = $derived(interdiffOn && interdiffState.status === "ready" && interdiffState.file ? interdiffState.file : file);
  const annotations = $derived<DiffAnnotations>(
    interdiffOn
      ? { ...PLAIN_ANNOTATIONS, readonly: true }
      : fileAnalysis
        ? { whitespaceHunks: new Set(fileAnalysis.whitespaceOnlyHunks), moved: movedLookup(analysis.scorecard?.moved ?? [], file.path), readonly: false }
        : PLAIN_ANNOTATIONS,
  );

  const isMd = $derived(canPreviewMarkdown(file) && !interdiffOn);

  const badge = $derived(changeBadge(file.changeType));
  const fileLevel = $derived(fileComments(comments.comments.filter((c) => c.file === file.path)));
  const addingFile = $derived(ui.adding?.file === file.path && ui.adding.line == null);
  const giant = $derived(lineCountOf(shown) > GIANT_FILE_LINES);
  const canToggleSplit = $derived(canOverrideFileSplit(file, diff.meta?.mode));
  const useSplit = $derived(resolveFileSplit(splitState, file, diff.meta?.mode));

  // noise files start collapsed once the scorecard knows about them, unless the reader already chose.
  $effect(() => {
    if (noise && !untrack(() => touched)) collapsed = true;
  });

  function setCollapsed(value: boolean): void {
    touched = true;
    collapsed = value;
  }

  // a global choice replaces every local override; other updates leave it intact.
  $effect(() => {
    const globalSplit = prefs.split;
    untrack(() => (splitState = syncGlobalSplit(splitState, globalSplit)));
  });

  async function saveFileComment(text: string, tag?: CommentTag): Promise<string | null> {
    const error = await comments.add(newComment({ file: file.path, line: null, lineContent: null, text, tag }));
    if (!error) ui.cancelAdd();
    return error;
  }
</script>

<section id={fileAnchorId(file.path)} data-file-path={file.path} class="file-section mb-4 rounded-lg border border-border bg-surface">
  <header data-file-header class="sticky top-0 z-10 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-t-lg border-b border-divider bg-surface-2 px-3 py-2">
    <button
      type="button"
      class="rounded p-0.5 text-muted hover:text-text"
      aria-expanded={!collapsed}
      aria-label={collapsed ? `Expand ${file.path}` : `Collapse ${file.path}`}
      onclick={() => setCollapsed(!collapsed)}
    >
      <ChevronDown size={15} class="transition-transform duration-150 {collapsed ? '-rotate-90' : ''}" />
    </button>
    <span class="grid size-4 shrink-0 place-items-center rounded font-mono text-[10px] font-semibold {badge.cls}" title={badge.label}>{badge.letter}</span>
    <span class="min-w-0 truncate font-mono text-sm text-text">{file.path}</span>
    {#if file.oldPath && file.oldPath !== file.path}
      <span class="truncate font-mono text-xs text-dim">← {file.oldPath}</span>
    {/if}
    <span class="ml-auto flex shrink-0 flex-wrap items-center gap-2 font-mono text-xs">
      {#if fileAnalysis}<FileFlags analysis={fileAnalysis} />{/if}
      {#if changedSinceReview}<InterdiffToggle on={sinceReview} onToggle={() => (sinceReview = !sinceReview)} />{/if}
      {#if file.additions}<span class="text-add-text">+{file.additions}</span>{/if}
      {#if file.deletions}<span class="text-del-text">−{file.deletions}</span>{/if}
      {#if isMd}
        <button
          class="rounded border border-border px-1.5 py-0.5 text-[10px] {preview ? 'bg-surface-2 text-accent' : 'text-muted hover:text-text'}"
          aria-label="Toggle rendered preview"
          aria-pressed={preview}
          title="Toggle rendered preview"
          onclick={() => (preview = !preview)}
        >{preview ? "Preview" : "Diff"}</button>
      {/if}
      {#if canToggleSplit}
        <button
          class="rounded border border-border px-1.5 py-0.5 text-[10px] {useSplit ? 'bg-surface-2 text-accent' : 'text-muted hover:text-text'}"
          aria-label="{useSplit ? 'Use unified' : 'Use side-by-side'} view for {file.path}"
          aria-pressed={useSplit}
          title="Override view for this file"
          onclick={() => (splitState = toggleFileSplit(splitState, file, diff.meta?.mode))}
        >{useSplit ? "Side-by-side" : "Unified"}</button>
      {/if}
      <button class="rounded p-1 text-muted hover:bg-surface hover:text-text" aria-label="Comment on {file.path}" title="Comment on this file" onclick={() => ui.startFileAdd(file.path)}>
        <MessagePlus size={14} />
      </button>
    </span>
  </header>

  {#if !collapsed}
    {#if interdiffOn && interdiffState.status === "loading"}
      <p class="px-4 py-3 text-sm text-muted" role="status">Loading changes since last review…</p>
    {:else if interdiffOn && interdiffState.status === "error"}
      <p class="px-4 py-3 text-sm text-del-text" role="alert">Could not load changes since last review: {interdiffState.message}</p>
    {:else if interdiffOn && interdiffState.status === "ready" && !interdiffState.file}
      <p class="px-4 py-3 text-sm text-dim">No changes since last review.</p>
    {:else if isMd && preview}
      <MarkdownPreview {file} />
    {:else if file.binary}
      <p class="px-4 py-3 text-sm text-muted">Binary file — no textual diff.</p>
    {:else if shown.hunks.length === 0}
      <p class="px-4 py-3 text-sm text-dim">No changes to display.</p>
    {:else if giant && !loaded}
      <div class="flex items-center gap-3 px-4 py-3 text-sm text-muted">
        <span>Large diff — hidden to keep things fast.</span>
        <button class="rounded border border-border px-2 py-1 text-xs text-text hover:bg-surface-2" onclick={() => (loaded = true)}>Load diff</button>
      </div>
    {:else if !giant && !mounted}
      <div style="height:{estimatedHeight(shown)}px" use:nearViewport={() => (mounted = true)}></div>
    {:else}
      <div class="diff-scroll {useSplit ? 'split-scroll' : 'overflow-x-auto'} {prefs.wrap ? 'wrap' : ''}" use:revealRows>
        {#if useSplit}<SplitDiff file={shown} {annotations} />{:else}<UnifiedDiff file={shown} {annotations} />{/if}
      </div>
    {/if}

    {#if fileLevel.length > 0 || addingFile}
      <div class="flex flex-col gap-2 border-t border-divider px-3 py-2">
        {#if fileLevel.length > 0}<CommentThread comments={fileLevel} />{/if}
        {#if addingFile}
          <CommentEditor
            onSave={saveFileComment}
            onCancel={() => ui.cancelAdd()}
          />
        {/if}
      </div>
    {/if}
  {:else if noise}
    <div class="noise-note">
      <span>{NOISE_LABEL[noise]} — collapsed</span>
      <button type="button" class="chip-btn" onclick={() => setCollapsed(false)}>Expand</button>
    </div>
  {/if}
</section>
