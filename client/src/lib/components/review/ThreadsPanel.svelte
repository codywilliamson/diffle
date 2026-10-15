<script lang="ts">
  import type { Comment } from "$types";
  import { getAppState } from "$lib/state/context";
  import { isResolved } from "$lib/state/reviewRecord";
  import Modal from "../Modal.svelte";

  type Filter = "open" | "all" | "resolved";
  const FILTERS: { id: Filter; label: string }[] = [
    { id: "open", label: "Open" },
    { id: "all", label: "All" },
    { id: "resolved", label: "Resolved" },
  ];

  const { ui, comments } = getAppState();
  let filter = $state<Filter>("open");

  const staleIds = $derived(new Set(comments.stale.map((c) => c.id)));
  const shown = $derived(
    comments.comments.filter((c) => (filter === "all" ? true : filter === "resolved" ? isResolved(c) : !isResolved(c))),
  );
  // grouped by file, file-level first, then by line.
  const groups = $derived.by(() => {
    const byFile = new Map<string, Comment[]>();
    for (const c of shown) byFile.set(c.file, [...(byFile.get(c.file) ?? []), c]);
    return [...byFile.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([file, list]) => ({ file, list: list.toSorted((a, b) => (a.line ?? 0) - (b.line ?? 0)) }));
  });
  const countOf = (f: Filter) =>
    comments.comments.filter((c) => (f === "all" ? true : f === "resolved" ? isResolved(c) : !isResolved(c))).length;

  function where(c: Comment): string {
    if (c.line == null) return "file";
    const end = c.endLine != null && c.endLine !== c.line ? `–${c.endLine}` : "";
    return `${c.side === "old" ? "old " : ""}L${c.line}${end}`;
  }
  const firstLine = (text: string) => text.split("\n").find((l) => l.trim()) ?? "";
  const lastSpeaker = (c: Comment) => c.replies?.at(-1)?.author ?? c.author ?? "reviewer";
</script>

<Modal title="Threads" wide onClose={() => ui.closeOverlay()}>
  <div class="mb-3 flex gap-1.5" role="group" aria-label="Filter threads">
    {#each FILTERS as f (f.id)}
      <button
        type="button"
        class="rounded-full border px-2.5 py-0.5 text-xs {filter === f.id ? 'border-accent text-accent' : 'border-border text-muted hover:text-text'}"
        aria-pressed={filter === f.id}
        onclick={() => (filter = f.id)}
      >{f.label} {countOf(f.id)}</button>
    {/each}
  </div>

  {#if groups.length === 0}
    <p class="py-6 text-center text-sm text-dim">No {filter === "all" ? "" : filter} threads.</p>
  {:else}
    <div class="flex max-h-[60vh] flex-col gap-3 overflow-y-auto">
      {#each groups as group (group.file)}
        <section>
          <h3 class="mb-1 truncate font-mono text-xs text-muted" title={group.file}>{group.file}</h3>
          <ul class="flex flex-col gap-0.5">
            {#each group.list as c (c.id)}
              {@const stale = staleIds.has(c.id)}
              <li>
                <button
                  type="button"
                  class="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-surface-2 disabled:cursor-default disabled:opacity-60 disabled:hover:bg-transparent"
                  disabled={stale}
                  title={stale ? "Outdated: its line left the diff" : "Jump to thread"}
                  onclick={() => ui.focusComment(c.file, c.id)}
                >
                  <span class="size-2 shrink-0 rounded-full {isResolved(c) ? 'bg-border' : c.status === 'addressed' ? 'bg-mod-badge-text' : 'bg-accent'}" aria-hidden="true"></span>
                  <span class="w-16 shrink-0 font-mono text-xs text-muted">{where(c)}</span>
                  {#if c.author === "agent"}<span class="comment-chip bg-surface-2">Agent</span>{/if}
                  <span class="min-w-0 flex-1 truncate">{firstLine(c.text)}</span>
                  {#if stale}<span class="text-xs text-dim">outdated</span>{/if}
                  {#if c.replies?.length}
                    <span class="shrink-0 text-xs text-dim">{c.replies.length} repl{c.replies.length === 1 ? "y" : "ies"} · last {lastSpeaker(c)}</span>
                  {/if}
                </button>
              </li>
            {/each}
          </ul>
        </section>
      {/each}
    </div>
  {/if}
</Modal>
