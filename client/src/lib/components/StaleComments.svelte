<script lang="ts">
  import type { Comment } from "$types";
  import { getAppState } from "$lib/state/context";
  import CommentThread from "./comment/CommentThread.svelte";

  const { comments } = getAppState();
  const stale = $derived(comments.stale);

  // human label for where an orphaned comment used to live.
  function locationLabel(c: Comment): string {
    if (c.line == null) return `${c.file} — file-level`;
    const kind = c.side === "old" ? "old line" : "line";
    const range = c.endLine != null && c.endLine !== c.line ? `${c.line}–${c.endLine}` : `${c.line}`;
    return `${c.file} — ${kind} ${range}`;
  }
</script>

{#if stale.length > 0}
  <section class="mb-4 rounded-lg border border-border bg-surface">
    <header class="border-b border-divider bg-surface-2 px-3 py-2">
      <span class="font-serif text-sm text-text">From earlier reviews ({stale.length})</span>
      <p class="text-xs text-dim">No longer in this diff — excluded from the feedback. Resolve or delete to clear.</p>
    </header>
    <div class="flex flex-col gap-3 p-3">
      {#each stale as comment (comment.id)}
        <div>
          <div class="mb-1 font-mono text-xs text-dim">{locationLabel(comment)}</div>
          <CommentThread comments={[comment]} />
        </div>
      {/each}
    </div>
  </section>
{/if}
