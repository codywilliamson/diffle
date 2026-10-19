<script lang="ts">
  import { getAppState } from "$lib/state/context";
  import { listKey } from "$lib/lsp/listKeys";
  import { nameSegments } from "$lib/lsp/fuzzy";
  import LspPopup from "./LspPopup.svelte";
  import SymbolIcon from "./SymbolIcon.svelte";

  // gs lists the symbols of the current file as an outline, gS searches the repository. the input
  // keeps focus the whole time (typing filters), so only the arrows and Enter move and pick.
  const { lsp } = getAppState();
  const symbols = lsp.symbols;
  const INDENT_PX = 14;

  const title = $derived(symbols.scope === "document" ? `Symbols in ${symbols.path ?? "this file"}` : "Symbols in the repository");
  const placeholder = $derived(symbols.scope === "document" ? "Filter symbols in this file…" : "Search symbols in the repository…");

  $effect(() => {
    document.querySelector(`[data-symbol-index="${symbols.selected}"]`)?.scrollIntoView({ block: "nearest" });
  });

  const status = $derived.by(() => {
    if (symbols.status === "loading") return "Loading…";
    if (symbols.status === "error") return "";
    if (symbols.rows.length === 0) return symbols.scope === "workspace" && symbols.query.trim() === "" ? "Type to search" : "No symbols";
    const n = symbols.rows.length;
    return symbols.truncated ? `Showing ${n} of ${symbols.total}` : `${n} ${n === 1 ? "symbol" : "symbols"}`;
  });

  function onKeydown(event: KeyboardEvent): void {
    listKey(event, { move: (d) => symbols.move(d), activate: () => symbols.activate() }, false);
  }
</script>

{#if symbols.open}
  <LspPopup {title} wide onClose={() => symbols.close()}>
    <div class="border-b border-border px-3 py-2">
      <input
        type="text"
        data-autofocus
        class="w-full rounded-md border border-border bg-surface-2 px-2 py-1.5 text-sm text-text placeholder:text-dim focus:border-focus"
        aria-label={title}
        {placeholder}
        autocomplete="off"
        spellcheck="false"
        value={symbols.query}
        oninput={(event) => symbols.setQuery(event.currentTarget.value)}
        onkeydown={onKeydown}
      />
    </div>
    <div role="listbox" aria-label={title} class="min-h-0 flex-1 overflow-auto py-1" data-symbol-list>
      {#each symbols.rows as row, index (row.key)}
        <!-- the input handles the keys -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div
          role="option"
          tabindex="-1"
          aria-selected={index === symbols.selected}
          data-symbol-index={index}
          data-changed={row.changed ? "" : undefined}
          class="flex cursor-pointer items-center gap-1.5 py-1 pr-3 text-sm hover:bg-surface-2 {index === symbols.selected ? 'bg-surface-2 shadow-[inset_2px_0_0_var(--accent)]' : ''}"
          style="padding-left:{12 + row.depth * INDENT_PX}px"
          onclick={() => symbols.activate(index)}
        >
          <SymbolIcon kind={row.kind} />
          <span class="truncate font-mono text-text">{#each nameSegments(row.name, row.indices) as part, i (i)}{#if part.hit}<b class="font-semibold text-accent">{part.text}</b>{:else}{part.text}{/if}{/each}</span>
          {#if row.detail}<span class="truncate font-mono text-xs text-dim">{row.detail}</span>{/if}
          {#if row.container}<span class="truncate text-xs text-dim">{row.container}</span>{/if}
          {#if row.changed}<span class="ml-auto shrink-0 rounded border border-border px-1 text-[10px] text-accent" title="Overlaps a changed line">changed</span>{/if}
        </div>
      {/each}
    </div>
    <p class="border-t border-border px-4 py-1.5 text-xs text-dim" role="status" aria-live="polite" data-symbol-status>{status}</p>
  </LspPopup>
{/if}
