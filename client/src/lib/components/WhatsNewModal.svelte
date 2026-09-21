<script lang="ts">
  import Modal from "./Modal.svelte";
  import { WHATS_NEW } from "$lib/whatsNew";
  import { saveState } from "$lib/api/meta";
  import { getAppState } from "$lib/state/context";

  const { ui } = getAppState();

  // dismissing marks this version seen so it does not auto-open again (best-effort).
  function close(): void {
    void saveState({ seenVersion: WHATS_NEW.version }).catch(() => {});
    ui.closeOverlay();
  }
</script>

<Modal title="What's new in diffle" onClose={close}>
  <ul class="flex flex-col gap-2 text-sm text-muted">
    {#each WHATS_NEW.highlights as line (line)}
      <li class="flex gap-2">
        <span class="text-accent">•</span>
        <span>{line}</span>
      </li>
    {/each}
  </ul>
</Modal>
