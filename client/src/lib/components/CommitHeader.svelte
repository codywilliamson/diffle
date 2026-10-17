<script lang="ts">
  import Copy from "@lucide/svelte/icons/copy";
  import Check from "@lucide/svelte/icons/check";
  import type { CommitInfo } from "$types";

  let { commit }: { commit: CommitInfo } = $props();

  const COPIED_MS = 1500;
  let copied = $state(false);

  const when = $derived.by(() => {
    const date = new Date(commit.date);
    return Number.isNaN(date.getTime()) ? commit.date : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  });

  async function copyHash(): Promise<void> {
    try {
      await navigator.clipboard.writeText(commit.hash);
      copied = true;
      setTimeout(() => (copied = false), COPIED_MS);
    } catch {
      copied = false;
    }
  }
</script>

<section aria-label="Commit" class="border-b border-divider bg-surface px-4 py-3">
  <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
    <button
      type="button"
      class="flex items-center gap-1 rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-accent hover:text-text"
      title={commit.hash}
      aria-label={copied ? "Copied commit hash" : `Copy commit hash ${commit.shortHash}`}
      onclick={copyHash}
    >
      {commit.shortHash}
      {#if copied}<Check size={12} />{:else}<Copy size={12} />{/if}
    </button>
    <h2 class="min-w-0 flex-1 break-words text-base font-medium text-text">{commit.subject}</h2>
  </div>
  {#if commit.body}
    <p class="mt-2 whitespace-pre-wrap break-words text-sm text-muted">{commit.body}</p>
  {/if}
  <p class="mt-2 font-mono text-xs text-dim">
    {commit.author} · <time datetime={commit.date}>{when}</time>
    {#if commit.isMerge}
      <span class="block sm:ml-2 sm:inline">merge, showing changes against first parent {commit.baseShortHash}</span>
    {:else if commit.baseShortHash === null}
      <span class="block sm:ml-2 sm:inline">root commit, compared with the empty tree</span>
    {/if}
  </p>
</section>
