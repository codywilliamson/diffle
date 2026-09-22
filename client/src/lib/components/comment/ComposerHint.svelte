<script lang="ts">
  // the composer's keyboard contract, referenced by its textarea via aria-describedby.
  let { id, action, class: className = "" }: { id: string; action: string; class?: string } = $props();

  const MODIFIER = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl";
</script>

<p {id} class="composer-hint {className}"><kbd>{MODIFIER}</kbd>+<kbd>Enter</kbd> to {action} · <kbd>Esc</kbd> to cancel</p>
