<script lang="ts">
  import Modal from "./Modal.svelte";
  import { SHORTCUTS } from "$lib/shortcuts";
  import { getAppState } from "$lib/state/context";

  const { ui } = getAppState();
</script>

<Modal title="Keyboard shortcuts" onClose={() => ui.closeOverlay()}>
  <dl class="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-sm">
    {#each SHORTCUTS as s (s.key)}
      <dt><kbd class="rounded border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-text">{s.key}</kbd></dt>
      <dd class="text-muted">{s.label}</dd>
    {/each}
  </dl>
</Modal>
