<script lang="ts">
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import MessagePlus from "@lucide/svelte/icons/message-square-plus";
  import type { DiffFile } from "$types";
  import { getAppState } from "$lib/state/context";
  import { changeBadge } from "$lib/format";
  import { fileAnchorId } from "$lib/diff/tree";
  import { fileComments, newComment } from "$lib/diff/threads";
  import UnifiedDiff from "./UnifiedDiff.svelte";
  import CommentThread from "../comment/CommentThread.svelte";
  import CommentEditor from "../comment/CommentEditor.svelte";

  let { file }: { file: DiffFile } = $props();
  const { ui, comments } = getAppState();
  let collapsed = $state(false);

  const badge = $derived(changeBadge(file.changeType));
  const fileLevel = $derived(fileComments(comments.comments.filter((c) => c.file === file.path)));
  const addingFile = $derived(ui.adding?.file === file.path && ui.adding.line == null);
</script>

<section id={fileAnchorId(file.path)} class="file-section mb-4 overflow-hidden rounded-lg border border-border bg-surface">
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
      <button class="rounded p-1 text-muted hover:bg-surface hover:text-text" aria-label="Comment on {file.path}" title="Comment on this file" onclick={() => ui.startFileAdd(file.path)}>
        <MessagePlus size={14} />
      </button>
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

    {#if fileLevel.length > 0 || addingFile}
      <div class="flex flex-col gap-2 border-t border-divider p-2">
        {#if fileLevel.length > 0}<CommentThread comments={fileLevel} />{/if}
        {#if addingFile}
          <CommentEditor
            onSave={(text, tag) => {
              comments.add(newComment({ file: file.path, line: null, lineContent: null, text, tag }));
              ui.cancelAdd();
            }}
            onCancel={() => ui.cancelAdd()}
          />
        {/if}
      </div>
    {/if}
  {/if}
</section>
