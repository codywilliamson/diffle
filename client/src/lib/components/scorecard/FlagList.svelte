<script lang="ts">
  import type { ChangeFlag } from "$types";
  import { BAND_BG, BAND_TEXT, FLAG_LABEL, flagBand } from "$lib/scorecard/bands";

  let { flags, onPick }: { flags: ChangeFlag[]; onPick: () => void } = $props();
</script>

<ul class="mt-1 space-y-1">
  {#each flags as flag}
    {@const band = flagBand(flag)}
    <li>
      <button type="button" class="flex w-full items-start gap-2 rounded px-1 py-0.5 text-left text-sm hover:bg-surface-2" onclick={onPick}>
        <span class="shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium {BAND_BG[band]} {BAND_TEXT[band]}">{FLAG_LABEL[flag.kind]}</span>
        <span class="min-w-0 text-muted">{flag.reason}{#if flag.line != null}<span class="ml-1.5 font-mono text-xs text-dim">line {flag.line}</span>{/if}</span>
      </button>
    </li>
  {/each}
</ul>
