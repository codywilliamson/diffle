<script lang="ts">
  import { untrack } from "svelte";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import MessagePlus from "@lucide/svelte/icons/message-square-plus";
  import type { CommentTag, DiffFile } from "$types";
  import { getAppState } from "$lib/state/context";
  import { changeBadge, isMarkdown } from "$lib/format";
  import { fileAnchorId } from "$lib/diff/tree";
  import { fileComments, newComment } from "$lib/diff/threads";
  import { lineCountOf, estimatedHeight, GIANT_FILE_LINES } from "$lib/diff/metrics";
  import { nearViewport } from "$lib/actions";
  import { fade } from "$lib/motion";
  import UnifiedDiff from "./UnifiedDiff.svelte";
  import SplitDiff from "./SplitDiff.svelte";
  import MarkdownPreview from "./MarkdownPreview.svelte";
  import CommentThread from "../comment/CommentThread.svelte";
  import CommentEditor from "../comment/CommentEditor.svelte";

  let { file }: { file: DiffFile } = $props();
  const { ui, comments, prefs, diff } = getAppState();
  // deleted files collapse by default (github-style) — the removal is rarely re-read line by line.
  let collapsed = $state(untrack(() => file.changeType === "deleted"));
  let loaded = $state(false); // giant-file manual gate
  let mounted = $state(false); // near-viewport lazy mount
  let preview = $state(false); // markdown: rendered preview vs diff

  const isMd = $derived(isMarkdown(file.path) && !file.binary);

  const badge = $derived(changeBadge(file.changeType));
  const fileLevel = $derived(fileComments(comments.comments.filter((c) => c.file === file.path)));
  const addingFile = $derived(ui.adding?.file === file.path && ui.adding.line == null);
  const giant = $derived(lineCountOf(file) > GIANT_FILE_LINES);
  // single-sided files (added/deleted) and browse mode force the unified view.
  const singleSided = $derived(file.changeType === "added" || file.changeType === "deleted");
  const useSplit = $derived(prefs.split && !singleSided && diff.meta?.mode !== "browse");

  async function saveFileComment(text: string, tag?: CommentTag): Promise<string | null> {
    const error = await comments.add(newComment({ file: file.path, line: null, lineContent: null, text, tag }));
    if (!error) ui.cancelAdd();
    return error;
  }
</script>

<section id={fileAnchorId(file.path)} class="file-section mb-4 rounded-lg border border-border bg-surface">
  <header class="sticky top-0 z-10 flex items-center gap-2 rounded-t-lg border-b border-divider bg-surface-2 px-3 py-2">
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
      {#if isMd}
        <button
          class="rounded border border-border px-1.5 py-0.5 text-[10px] {preview ? 'bg-surface-2 text-accent' : 'text-muted hover:text-text'}"
          aria-label="Toggle rendered preview"
          aria-pressed={preview}
          title="Toggle rendered preview"
          onclick={() => (preview = !preview)}
        >{preview ? "Preview" : "Diff"}</button>
      {/if}
      <button class="rounded p-1 text-muted hover:bg-surface hover:text-text" aria-label="Comment on {file.path}" title="Comment on this file" onclick={() => ui.startFileAdd(file.path)}>
        <MessagePlus size={14} />
      </button>
    </span>
  </header>

  {#if !collapsed}
    {#if isMd && preview}
      <MarkdownPreview {file} />
    {:else if file.binary}
      <p class="px-4 py-3 text-sm text-muted">Binary file — no textual diff.</p>
    {:else if file.hunks.length === 0}
      <p class="px-4 py-3 text-sm text-dim">No changes to display.</p>
    {:else if giant && !loaded}
      <div class="flex items-center gap-3 px-4 py-3 text-sm text-muted">
        <span>Large diff — hidden to keep things fast.</span>
        <button class="rounded border border-border px-2 py-1 text-xs text-text hover:bg-surface-2" onclick={() => (loaded = true)}>Load diff</button>
      </div>
    {:else if !giant && !mounted}
      <div style="height:{estimatedHeight(file)}px" use:nearViewport={() => (mounted = true)}></div>
    {:else}
      <div class="overflow-x-auto {prefs.wrap ? 'wrap' : ''}" in:fade>
        {#if useSplit}<SplitDiff {file} />{:else}<UnifiedDiff {file} />{/if}
      </div>
    {/if}

    {#if fileLevel.length > 0 || addingFile}
      <div class="flex flex-col gap-2 border-t border-divider p-2">
        {#if fileLevel.length > 0}<CommentThread comments={fileLevel} />{/if}
        {#if addingFile}
          <CommentEditor
            onSave={saveFileComment}
            onCancel={() => ui.cancelAdd()}
          />
        {/if}
      </div>
    {/if}
  {/if}
</section>
