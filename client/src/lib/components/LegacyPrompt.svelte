<script lang="ts">
  import { getAppState } from "$lib/state/context";
  import { detectLegacyReview } from "$lib/api/review";

  const { review } = getAppState();
  let present = $state(false);
  let dismissed = $state(false);

  $effect(() => {
    detectLegacyReview()
      .then((r) => (present = r.present))
      .catch(() => {});
  });

  // only a durable review can adopt a legacy file; import/ignore/remove, never silently change.
  const show = $derived(present && !dismissed && review.reviewId != null);
</script>

{#if show}
  <div class="flex flex-wrap items-center gap-3 border-b border-divider bg-surface-2 px-4 py-2 text-sm">
    <span class="text-text">A legacy <code class="font-mono text-xs">.review</code> file was found.</span>
    <button class="ml-auto rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground" onclick={() => { void review.importLegacy(review.reviewId as string); dismissed = true; }}>Import</button>
    <button class="rounded px-2 py-1 text-xs text-muted hover:text-text" onclick={() => { void review.ignoreLegacy(); dismissed = true; }}>Ignore</button>
    <button class="rounded px-2 py-1 text-xs text-destructive hover:underline" onclick={() => { if (confirm('Remove the .review file? This deletes it.')) { void review.removeLegacy(true); dismissed = true; } }}>Remove</button>
  </div>
{/if}
