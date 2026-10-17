<script lang="ts">
  import { getAppState } from "$lib/state/context";
  import { describeCursor } from "$lib/state/describeCursor";

  // a polite live region: speaks "<file> line <n>, <side>" once the cursor settles, so a held
  // key does not queue a sentence per row. it never takes focus.
  const ANNOUNCE_DELAY_MS = 250;
  const { cursor } = getAppState();
  let message = $state("");

  $effect(() => {
    const pos = cursor.pos;
    if (!pos) return;
    const timer = setTimeout(() => (message = describeCursor(pos)), ANNOUNCE_DELAY_MS);
    return () => clearTimeout(timer);
  });
</script>

<div class="sr-only" aria-live="polite" aria-atomic="true" data-cursor-announcer>{message}</div>
