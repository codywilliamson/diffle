<script lang="ts">
  import { PRODUCT } from "$product";
  import { getAppState } from "$lib/state/context";

  const { connection, review } = getAppState();
  // --review-id reopens this review's record; --port keeps the origin this page can reconnect to.
  // neither flag restores any other mode the old process was started in.
  const restart = $derived(
    [PRODUCT.name, review.reviewId ? `--review-id ${review.reviewId}` : "", location.port ? `--port ${location.port}` : ""].filter(Boolean).join(" "),
  );
</script>

{#if connection.mismatch}
  <div role="alert" data-testid="server-mismatch" class="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
    <strong class="font-semibold">A different review is running on this port.</strong>
    <span class="text-text">Sending feedback and saving comments are off for this page.</span>
    <a href={connection.reloadUrl} class="rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground">Reload to open it</a>
  </div>
{:else if connection.gone}
  <div role="alert" data-testid="server-gone" class="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
    <strong class="font-semibold">The {PRODUCT.name} server is gone.</strong>
    <span class="text-text">Sending feedback and saving comments are off. Restart {PRODUCT.name} for this repository, for example <code class="rounded bg-surface-2 px-1 py-0.5 font-mono text-xs">{restart}</code>, and this page reconnects on its own.</span>
  </div>
{/if}
