<script lang="ts">
  import type { FileAnalysis } from "$types";
  import { fileChips, MAX_INLINE_CHIPS } from "$lib/diff/fileChips";

  let { analysis }: { analysis: FileAnalysis } = $props();
  const summary = $derived(fileChips(analysis));
  const inline = $derived(summary.chips.slice(0, MAX_INLINE_CHIPS));
  const overflow = $derived(summary.chips.slice(MAX_INLINE_CHIPS));
  let open = $state(false);
  let root: HTMLElement | undefined = $state();
  const popId = $props.id();

  function onWindowClick(event: MouseEvent): void {
    if (open && root && !root.contains(event.target as Node)) open = false;
  }
  function onKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape" && open) {
      open = false;
      event.stopPropagation();
    }
  }
</script>

<svelte:window onclick={onWindowClick} />

{#if summary.chips.length > 0}
  <span class="flags" bind:this={root} onkeydown={onKeydown} role="presentation">
    {#each inline as chip (chip.id)}
      <span class="chip {chip.band ? `band-${chip.band}` : ''}">{chip.text}</span>
    {/each}
    {#if overflow.length > 0}
      <span class="chip">+{overflow.length}</span>
    {/if}
    {#if summary.details.length > 0 || overflow.length > 0}
      <button
        type="button"
        class="chip-btn"
        aria-expanded={open}
        aria-controls={popId}
        aria-label="Show flag details for {analysis.path}"
        onclick={() => (open = !open)}
      >Details</button>
      {#if open}
        <div id={popId} class="flag-pop" role="group" aria-label="Flags for {analysis.path}">
          <ul>
            {#each overflow as chip (chip.id)}<li>{chip.text}</li>{/each}
            {#each summary.details as line, i (i)}<li>{line}</li>{/each}
          </ul>
        </div>
      {/if}
    {/if}
  </span>
{/if}
