<script lang="ts">
  import { getAppState } from "$lib/state/context";
  import { describeCursor, describeVisual, VISUAL_CANCELLED } from "$lib/state/describeCursor";

  // a polite live region: speaks "<file> line <n>, <side>" once the cursor settles, so a held
  // key does not queue a sentence per row. it never takes focus.
  const ANNOUNCE_DELAY_MS = 250;
  const { cursor, ui } = getAppState();
  let message = $state("");
  let wasVisual = false;

  // a visual range speaks its extent; leaving it without opening an editor says it was cancelled
  function say(): string | null {
    const range = cursor.visualRange;
    const adding = ui.adding;
    const cancelled = wasVisual && !cursor.visual && !adding;
    wasVisual = cursor.visual;
    if (range) return describeVisual(range);
    if (cancelled) return VISUAL_CANCELLED;
    return cursor.pos ? describeCursor(cursor.pos) : null;
  }

  $effect(() => {
    const text = say();
    if (text === null) return;
    const timer = setTimeout(() => (message = text), ANNOUNCE_DELAY_MS);
    return () => clearTimeout(timer);
  });
</script>

<div class="sr-only" aria-live="polite" aria-atomic="true" data-cursor-announcer>{message}</div>
