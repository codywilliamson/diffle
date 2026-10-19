<script lang="ts">
  // the composer's keyboard contract, referenced by its textarea via aria-describedby.
  let { id, action, suggest = false, class: className = "" }: { id: string; action: string; suggest?: boolean; class?: string } = $props();

  const MODIFIER = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl";
</script>

<p {id} class="composer-hint {className}"><kbd>{MODIFIER}</kbd>+<kbd>Enter</kbd> to {action} · <kbd>Esc</kbd> to cancel{#if suggest}{" · "}<kbd>Ctrl</kbd>+<kbd>G</kbd> to suggest a change{/if}</p>
