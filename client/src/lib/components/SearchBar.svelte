<script lang="ts">
  import X from "@lucide/svelte/icons/x";
  import { getAppState } from "$lib/state/context";

  // the in-file search box: floats over the top right of the diff pane (no layout shift). Esc is
  // handled by the keymap, which closes search one layer per press.
  const { search } = getAppState();
  let input: HTMLInputElement | undefined = $state();

  $effect(() => {
    if (!search.focusSeq) return;
    input?.focus();
    input?.select();
  });

  const counter = $derived.by(() => {
    if (search.query === "") return "";
    if (search.total === 0) return "No matches";
    if (search.active < 0) return search.total === 1 ? "1 match" : `${search.total} matches`;
    return `${search.active + 1} / ${search.total}`;
  });

  function onKeydown(event: KeyboardEvent): void {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (event.shiftKey) search.prev();
    else search.next();
    // hand the keyboard back to the diff so n and N work; stay put when there is nothing to step to
    if (search.total > 0) input?.blur();
  }
</script>

<div
  role="search"
  class="absolute top-2 right-4 z-30 flex max-w-[calc(100%-2rem)] items-center gap-2 rounded-md border border-border bg-surface px-2 py-1 shadow-lg"
  data-search-bar
>
  <input
    bind:this={input}
    type="text"
    class="min-w-0 flex-1 bg-transparent px-1 py-0.5 text-sm text-text placeholder:text-dim sm:w-56 sm:flex-none"
    aria-label="Search this file"
    placeholder="Search this file…"
    autocomplete="off"
    spellcheck="false"
    value={search.query}
    oninput={(event) => search.setQuery(event.currentTarget.value)}
    onkeydown={onKeydown}
  />
  <span class="min-w-[4.5rem] text-right font-mono text-xs text-muted" role="status" aria-live="polite" data-search-count>{counter}</span>
  <button
    type="button"
    class="grid size-6 place-items-center rounded text-muted hover:text-text"
    aria-label="Close search"
    onclick={() => search.close()}
  ><X size={14} /></button>
</div>
