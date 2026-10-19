<script lang="ts">
  import X from "@lucide/svelte/icons/x";
  import type { SearchHit } from "$types";
  import { getAppState } from "$lib/state/context";
  import { previewSegments } from "$lib/diff/previewSegments";

  // the g/ panel: a query row (same look as the in-file search bar) over the hits grouped by file.
  // the input takes the arrows and Enter; after Enter the list has focus and takes j, k, the
  // arrows and Enter, so a reader can step through hits without leaving the keyboard. Esc is
  // handled by the keymap (one layer per press).
  const { searchAll: search } = getAppState();
  let input: HTMLInputElement | undefined = $state();
  let list: HTMLDivElement | undefined = $state();

  const TRUNCATED_NOTE = "Showing the first matches only. Narrow the query to see the rest.";

  interface Group {
    path: string;
    rows: { hit: SearchHit; index: number }[];
  }

  const groups = $derived.by((): Group[] => {
    const out: Group[] = [];
    search.hits.forEach((hit, index) => {
      const last = out[out.length - 1];
      if (last && last.path === hit.path) last.rows.push({ hit, index });
      else out.push({ path: hit.path, rows: [{ hit, index }] });
    });
    return out;
  });

  $effect(() => {
    if (!search.focusSeq) return;
    input?.focus();
    input?.select();
  });

  $effect(() => {
    const index = search.selected;
    list?.querySelector(`[data-hit-index="${index}"]`)?.scrollIntoView({ block: "nearest" });
  });

  const summary = $derived.by(() => {
    if (search.query.trim() === "") return "";
    if (search.status === "loading") return "Searching…";
    if (search.status === "error") return "";
    const n = search.hits.length;
    if (n === 0) return "No matches";
    return `${n}${search.truncated ? "+" : ""} ${n === 1 ? "match" : "matches"}`;
  });

  function moveKey(event: KeyboardEvent, allowLetters: boolean): boolean {
    if (event.ctrlKey || event.metaKey || event.altKey) return false;
    if (event.key === "ArrowDown" || (allowLetters && event.key === "j")) search.move(1);
    else if (event.key === "ArrowUp" || (allowLetters && event.key === "k")) search.move(-1);
    else return false;
    event.preventDefault();
    return true;
  }

  function onInputKeydown(event: KeyboardEvent): void {
    if (moveKey(event, false)) return;
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (search.hits.length === 0) return;
    search.activate();
    list?.focus();
  }

  function onListKeydown(event: KeyboardEvent): void {
    if (moveKey(event, true)) return;
    if (event.key === "Enter") {
      event.preventDefault();
      search.activate();
    } else if (event.key === "/") {
      event.preventDefault();
      input?.focus();
      input?.select();
    }
  }
</script>

{#if search.open}
  <section aria-label="Search all changed files" class="flex max-h-[45dvh] flex-col border-b border-border bg-surface" data-search-all>
    <div class="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-1.5">
      <input
        bind:this={input}
        type="text"
        class="min-w-0 flex-1 rounded-md border border-border bg-surface-2 px-2 py-1 text-sm text-text placeholder:text-dim focus:border-focus sm:max-w-sm"
        aria-label="Search all changed files"
        placeholder="Search all changed files…"
        autocomplete="off"
        spellcheck="false"
        value={search.query}
        oninput={(event) => search.setQuery(event.currentTarget.value)}
        onkeydown={onInputKeydown}
      />
      <button
        type="button"
        class="rounded border border-border px-1.5 py-0.5 font-mono text-xs {search.regex ? 'bg-surface-2 text-accent' : 'text-muted hover:text-text'}"
        aria-label="Regular expression"
        aria-pressed={search.regex}
        title="Regular expression"
        onclick={() => search.toggleRegex()}
      >.*</button>
      <span class="min-w-[4.5rem] font-mono text-xs text-muted" role="status" aria-live="polite" data-search-all-count>{summary}</span>
      <button
        type="button"
        class="ml-auto grid size-6 place-items-center rounded text-muted hover:text-text"
        aria-label="Close search"
        onclick={() => search.close()}
      ><X size={14} /></button>
    </div>

    {#if search.status === "error" && search.error}
      <p role="alert" class="border-t border-border px-4 py-1.5 text-xs text-destructive" data-search-all-error>{search.error}</p>
    {:else if search.hits.length > 0}
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div
        bind:this={list}
        role="listbox"
        tabindex="0"
        aria-label="Search results"
        class="min-h-0 flex-1 overflow-auto border-t border-border pb-1 outline-none focus-visible:ring-1 focus-visible:ring-focus"
        onkeydown={onListKeydown}
        data-search-results
      >
        {#each groups as group (group.path + group.rows[0]?.index)}
          <div class="px-4 pb-0.5 pt-2 font-mono text-xs text-muted" data-search-group>{group.path}</div>
          {#each group.rows as { hit, index } (index)}
            <!-- keys are handled once, by the listbox -->
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <div
              role="option"
              tabindex="-1"
              aria-selected={index === search.selected}
              data-hit-index={index}
              class="flex cursor-pointer items-baseline gap-2 px-4 py-0.5 font-mono text-xs hover:bg-surface-2 {index === search.selected ? 'bg-surface-2 shadow-[inset_2px_0_0_var(--accent)]' : ''}"
              onclick={() => search.activate(index)}
            >
              <span class="w-8 shrink-0 text-dim">{hit.side}</span>
              <span class="w-10 shrink-0 text-right text-dim">{hit.line}</span>
              <span class="min-w-0 flex-1 truncate whitespace-pre text-text">{#each previewSegments(hit.preview, hit.ranges) as part, i (i)}{#if part.match}<mark class="sm">{part.text}</mark>{:else}{part.text}{/if}{/each}</span>
            </div>
          {/each}
        {/each}
        {#if search.truncated}
          <p class="px-4 py-1.5 text-xs text-dim" data-search-all-truncated>{TRUNCATED_NOTE}</p>
        {/if}
      </div>
    {/if}
  </section>
{/if}
