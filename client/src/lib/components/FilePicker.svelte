<script lang="ts">
  import { getAppState } from "$lib/state/context";
  import { listKey } from "$lib/lsp/listKeys";
  import { nameSegments } from "$lib/lsp/fuzzy";
  import LspPopup from "./lsp/LspPopup.svelte";

  // Ctrl+p: type to filter the changed files, arrows and Enter pick. the input keeps focus.
  const { filePicker, diff } = getAppState();
  const TITLE = "Go to file";

  $effect(() => {
    document.querySelector(`[data-file-index="${filePicker.selected}"]`)?.scrollIntoView({ block: "nearest" });
  });

  const status = $derived(
    filePicker.rows.length === 0
      ? diff.files.length === 0 ? "No files" : "No matching files"
      : `${filePicker.rows.length} ${filePicker.rows.length === 1 ? "file" : "files"}`,
  );

  function onKeydown(event: KeyboardEvent): void {
    listKey(event, { move: (d) => filePicker.move(d), activate: () => filePicker.activate() }, false);
  }
</script>

{#if filePicker.open}
  <LspPopup title={TITLE} wide onClose={() => filePicker.close()}>
    <div class="border-b border-border px-3 py-2">
      <input
        type="text"
        data-autofocus
        data-file-picker-input
        class="w-full rounded-md border border-border bg-surface-2 px-2 py-1.5 text-sm text-text placeholder:text-dim focus:border-focus"
        aria-label={TITLE}
        placeholder="Go to a changed file…"
        autocomplete="off"
        spellcheck="false"
        value={filePicker.query}
        oninput={(event) => filePicker.setQuery(event.currentTarget.value)}
        onkeydown={onKeydown}
      />
    </div>
    <div role="listbox" aria-label={TITLE} class="min-h-0 flex-1 overflow-auto py-1" data-file-picker-list>
      {#each filePicker.rows as row, index (row.path)}
        <!-- the input handles the keys -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div
          role="option"
          tabindex="-1"
          aria-selected={index === filePicker.selected}
          data-file-index={index}
          class="flex cursor-pointer items-center py-1 pl-3 pr-3 text-sm hover:bg-surface-2 {index === filePicker.selected ? 'bg-surface-2 shadow-[inset_2px_0_0_var(--accent)]' : ''}"
          onclick={() => filePicker.activate(index)}
        >
          <span class="truncate font-mono text-text">{#each nameSegments(row.path, row.indices) as part, i (i)}{#if part.hit}<b class="font-semibold text-accent">{part.text}</b>{:else}{part.text}{/if}{/each}</span>
        </div>
      {/each}
    </div>
    <p class="border-t border-border px-4 py-1.5 text-xs text-dim" role="status" aria-live="polite">{status}</p>
  </LspPopup>
{/if}
