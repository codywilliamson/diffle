<script lang="ts">
  import type { ReviewScorecard } from "$types";
  import Modal from "../Modal.svelte";
  import { getAppState } from "$lib/state/context";
  import CategoryRow from "./CategoryRow.svelte";
  import FileSignals from "./FileSignals.svelte";

  let { scorecard }: { scorecard: ReviewScorecard } = $props();
  const { ui } = getAppState();

  const { totals } = $derived(scorecard);
  const header = $derived(
    `${totals.effectiveLines} effective lines · ${totals.files} ${totals.files === 1 ? "file" : "files"} · ${totals.noiseLines} noise lines hidden`,
  );
  const hasSignal = (f: ReviewScorecard["files"][number]) => f.flags.length > 0 || f.churn > 0 || f.changedSinceReview === true;
  const withSignals = $derived(scorecard.files.filter(hasSignal));
  const quiet = $derived(scorecard.files.length - withSignals.length);

  function pick(path: string): void {
    ui.selectFile(path);
    ui.closeOverlay();
  }
</script>

<Modal title="Review scorecard" wide onClose={() => ui.closeOverlay()}>
  <p class="mb-2 font-mono text-xs text-muted" data-testid="scorecard-totals">{header}</p>
  <ul class="mb-4 rounded-md border border-border px-3">
    {#each scorecard.categories as category (category.id)}<CategoryRow {category} />{/each}
  </ul>

  <h3 class="mb-1 font-serif text-base text-text">Files</h3>
  {#if withSignals.length}
    <ul>
      {#each withSignals as file (file.path)}<FileSignals {file} onPick={() => pick(file.path)} />{/each}
    </ul>
  {/if}
  <p class="mt-2 text-sm text-dim">
    {#if withSignals.length === 0}No files have flags, recent churn or changes since the last review.{:else if quiet > 0}{quiet} other {quiet === 1 ? "file has" : "files have"} nothing to flag.{/if}
  </p>
</Modal>
