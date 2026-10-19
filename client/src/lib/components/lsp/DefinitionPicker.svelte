<script lang="ts">
  import { getAppState } from "$lib/state/context";
  import { listKey } from "$lib/lsp/listKeys";
  import LspPopup from "./LspPopup.svelte";

  // several definitions (overloads, partial classes, interface + implementation): pick one.
  const { lsp } = getAppState();
  const picker = $derived(lsp.picker);

  $effect(() => {
    const index = picker?.selected ?? 0;
    document.querySelector(`[data-def-index="${index}"]`)?.scrollIntoView({ block: "nearest" });
  });

  function onKeydown(event: KeyboardEvent): void {
    listKey(event, { move: (d) => lsp.pickerMove(d), activate: () => lsp.pickerActivate() }, true);
  }
</script>

{#if picker}
  <LspPopup title={picker.title} onClose={() => lsp.closeTopmost()}>
    <h2 class="border-b border-border px-4 py-2 font-serif text-base text-text">{picker.title}</h2>
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div role="listbox" tabindex="0" aria-label={picker.title} data-autofocus class="min-h-0 flex-1 overflow-auto py-1 outline-none" onkeydown={onKeydown} data-definition-picker>
      {#each picker.targets as target, index (target.uri + index)}
        <!-- keys are handled once, by the listbox -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div
          role="option"
          tabindex="-1"
          aria-selected={index === picker.selected}
          data-def-index={index}
          class="flex cursor-pointer items-baseline gap-2 px-4 py-1.5 font-mono text-xs hover:bg-surface-2 {index === picker.selected ? 'bg-surface-2 shadow-[inset_2px_0_0_var(--accent)]' : ''}"
          onclick={() => lsp.pickerActivate(index)}
        >
          <span class="min-w-0 flex-1 truncate text-text" title={target.absolutePath}>{target.path ?? target.absolutePath}</span>
          <span class="shrink-0 text-dim">line {target.range.start.line}</span>
          {#if target.inDiff}<span class="shrink-0 rounded border border-border px-1 text-[10px] text-accent">changed</span>{/if}
          {#if !target.inRepo}<span class="shrink-0 rounded border border-border px-1 text-[10px] text-muted">outside repo</span>{/if}
        </div>
      {/each}
    </div>
    <p class="border-t border-border px-4 py-1.5 text-xs text-dim">Enter opens, Esc closes</p>
  </LspPopup>
{/if}
