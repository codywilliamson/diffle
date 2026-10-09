<script lang="ts">
  import type { ScoreBand } from "$types";
  import { BAND_BG, BAND_DOT, BAND_LABEL, BAND_TEXT } from "$lib/scorecard/bands";

  let { band }: { band: ScoreBand } = $props();
</script>

<span class="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium {BAND_BG[band]} {BAND_TEXT[band]}" data-band={band}>
  <span class="size-1.5 rounded-full {BAND_DOT[band]}" aria-hidden="true"></span>{BAND_LABEL[band]}
</span>
