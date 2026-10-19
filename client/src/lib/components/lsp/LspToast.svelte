<script lang="ts">
  import { getAppState } from "$lib/state/context";

  // one line about why nothing happened (no server, no result). it clears itself.
  const { lsp } = getAppState();
  const notice = $derived(lsp.notice);
</script>

<div class="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4" aria-live="polite">
  {#if notice}
    {#key notice.seq}
      <p
        data-lsp-toast
        class="pointer-events-auto max-w-xl rounded-md border px-3 py-2 text-sm shadow-lg {notice.tone === 'error' ? 'border-destructive/40 bg-surface text-destructive' : 'border-border bg-surface text-text'}"
      >{notice.text}</p>
    {/key}
  {/if}
</div>
