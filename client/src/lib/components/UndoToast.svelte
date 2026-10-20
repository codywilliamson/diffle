<script lang="ts">
  import { getAppState } from "$lib/state/context";

  // "Comment deleted. Undo" for a few seconds after dd or the Delete button. u does the same.
  const { ui } = getAppState();
  const offer = $derived(ui.undo);
</script>

<div class="pointer-events-none fixed inset-x-0 bottom-16 z-50 flex justify-center px-4" aria-live="polite">
  {#if offer}
    {#key offer.seq}
      <p
        data-undo-toast
        class="pointer-events-auto flex items-center gap-3 rounded-md border border-border bg-surface px-3 py-2 text-sm text-text shadow-lg"
      >
        {offer.text}
        <button class="font-medium text-accent underline underline-offset-2" onclick={() => ui.runUndo()}>Undo</button>
      </p>
    {/key}
  {/if}
</div>
