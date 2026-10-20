<script lang="ts">
  import X from "@lucide/svelte/icons/x";
  import { getAppState } from "$lib/state/context";
  import { focusDiff } from "$lib/diff/focusDiff";

  // the in-file search row, between the top bar and the diff. it takes its space only while search
  // is open, so nothing moves while typing. Esc is handled by the keymap (one layer per press).
  const { search } = getAppState();
  let input: HTMLInputElement | undefined = $state();

  const PARTIAL_NOTE = {
    capped: "Match limit reached, some matches are not shown",
    cut: "A long line is only searched in its first 5000 characters",
  } as const;

  $effect(() => {
    if (!search.focusSeq) return;
    input?.focus();
    input?.select();
  });

  // "12+" when a cap hid matches
  const total = $derived(search.partial === "capped" ? `${search.total}+` : String(search.total));
  const counter = $derived.by(() => {
    if (search.query === "") return "";
    if (search.total === 0) return "No matches";
    if (search.active < 0) return search.total === 1 && search.partial === null ? "1 match" : `${total} matches`;
    return `${search.active + 1} / ${total}`;
  });

  function onKeydown(event: KeyboardEvent): void {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (event.shiftKey) search.prev();
    else search.next();
    // hand the keyboard back to the diff so n and N work; stay put when there is nothing to step to
    if (search.total > 0) focusDiff();
  }
</script>

{#if search.open}
  <div role="search" class="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border bg-surface px-4 py-1.5" data-search-bar>
    <input
      bind:this={input}
      type="text"
      class="min-w-0 flex-1 rounded-md border border-border bg-surface-2 px-2 py-1 text-sm text-text placeholder:text-dim focus:border-focus sm:max-w-sm"
      aria-label="Search this file"
      placeholder="Search this file…"
      autocomplete="off"
      spellcheck="false"
      value={search.query}
      oninput={(event) => search.setQuery(event.currentTarget.value)}
      onkeydown={onKeydown}
    />
    <span class="min-w-[4.5rem] font-mono text-xs text-muted" role="status" aria-live="polite" data-search-count>{counter}</span>
    {#if search.partial}
      <span class="text-xs text-dim" data-search-partial>{PARTIAL_NOTE[search.partial]}</span>
    {/if}
    <button
      type="button"
      class="ml-auto grid size-6 place-items-center rounded text-muted hover:text-text"
      aria-label="Close search"
      onclick={() => search.close()}
    ><X size={14} /></button>
  </div>
{:else if search.notice}
  <p role="status" class="border-b border-border bg-surface px-4 py-1.5 text-xs text-muted" data-search-notice>{search.notice}</p>
{/if}
