<script lang="ts">
  import X from "@lucide/svelte/icons/x";
  import { getAppState } from "$lib/state/context";
  import { listKey } from "$lib/lsp/listKeys";

  // gA: every reference to the word under the cursor, grouped by file (changed files first, they
  // carry a badge), with the highlighted one shown in context on the right. the list takes j, k,
  // the arrows and Enter; Esc is the keymap's.
  const { lsp } = getAppState();
  const refs = lsp.references;
  let list: HTMLDivElement | undefined = $state();

  $effect(() => {
    if (!refs.focusSeq || refs.status !== "ready") return;
    list?.focus();
  });

  $effect(() => {
    list?.querySelector(`[data-ref-index="${refs.selected}"]`)?.scrollIntoView({ block: "nearest" });
  });

  const current = $derived(refs.current);
  const peek = $derived.by(() => {
    if (!current) return [];
    const { reference } = current;
    const { start, end } = reference.range;
    return reference.contextLines.map((text, i) => {
      const number = reference.contextStartLine + i;
      const hit = number === start.line;
      return {
        number,
        hit,
        before: hit ? text.slice(0, start.character) : text,
        match: hit ? text.slice(start.character, end.line === start.line ? end.character : text.length) : "",
        after: hit && end.line === start.line ? text.slice(end.character) : "",
      };
    });
  });

  const summary = $derived.by(() => {
    if (refs.status === "loading") return "Searching…";
    if (refs.total === 0) return "No references";
    return refs.truncated ? `Showing ${refs.shown} of ${refs.total}` : `${refs.total} ${refs.total === 1 ? "reference" : "references"}`;
  });

  function onKeydown(event: KeyboardEvent): void {
    listKey(event, { move: (d) => refs.move(d), activate: () => refs.activate() }, true);
  }
</script>

{#if refs.open}
  <section aria-label="References" class="flex max-h-[45dvh] flex-col border-b border-border bg-surface" data-lsp-panel data-references-panel>
    <div class="flex items-center gap-3 px-4 py-1.5">
      <h2 class="min-w-0 truncate font-mono text-sm text-text">References to <span class="text-accent">{refs.word}</span></h2>
      <span class="font-mono text-xs text-muted" role="status" aria-live="polite" data-references-summary>{summary}</span>
      <button type="button" class="ml-auto grid size-6 place-items-center rounded text-muted hover:text-text" aria-label="Close references" onclick={() => refs.close()}>
        <X size={14} />
      </button>
    </div>
    {#if refs.groups.length > 0}
      <div class="grid min-h-0 flex-1 grid-cols-1 border-t border-border md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <div
          bind:this={list}
          role="listbox"
          tabindex="0"
          aria-label="References"
          class="min-h-0 overflow-auto pb-1 outline-none focus-visible:ring-1 focus-visible:ring-focus"
          onkeydown={onKeydown}
          data-references-list
        >
          {#each refs.groups as group (group.file.uri)}
            <div class="flex items-center gap-2 px-4 pb-0.5 pt-2 font-mono text-xs text-muted" data-reference-group>
              <span class="min-w-0 truncate" title={group.file.absolutePath}>{group.file.path ?? group.file.absolutePath}</span>
              {#if group.file.changed}<span class="shrink-0 rounded border border-border px-1 text-[10px] text-accent" data-changed-badge>changed</span>{/if}
            </div>
            {#each group.items as item (item.index)}
              <!-- keys are handled once, by the listbox -->
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <div
                role="option"
                tabindex="-1"
                aria-selected={item.index === refs.selected}
                data-ref-index={item.index}
                class="flex cursor-pointer items-baseline gap-2 px-4 py-0.5 font-mono text-xs hover:bg-surface-2 {item.index === refs.selected ? 'bg-surface-2 shadow-[inset_2px_0_0_var(--accent)]' : ''}"
                onclick={() => refs.activate(item.index)}
              >
                <span class="w-10 shrink-0 text-right text-dim">{item.reference.range.start.line}</span>
                <span class="min-w-0 flex-1 truncate whitespace-pre text-text">{item.reference.contextLines[item.reference.range.start.line - item.reference.contextStartLine]?.trim() ?? ""}</span>
              </div>
            {/each}
          {/each}
        </div>
        <div class="hidden min-h-0 overflow-auto border-l border-border bg-surface-2 py-1 md:block" aria-label="Context of the highlighted reference" data-reference-peek>
          {#each peek as line (line.number)}
            <div class="flex gap-2 px-3 font-mono text-xs leading-5 {line.hit ? 'bg-surface' : ''}">
              <span class="w-10 shrink-0 select-none text-right text-dim">{line.number}</span>
              <span class="whitespace-pre text-text">{line.before}{#if line.hit}<mark class="sm">{line.match}</mark>{/if}{line.after}</span>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </section>
{/if}
