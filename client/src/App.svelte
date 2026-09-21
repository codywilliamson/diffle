<script lang="ts">
  import { onMount } from "svelte";
  import { createAppState, setAppState } from "$lib/state/context";
  import TopBar from "$lib/components/TopBar.svelte";
  import FileIndex from "$lib/components/FileIndex.svelte";
  import DiffView from "$lib/components/diff/DiffView.svelte";
  import SyncNotice from "$lib/components/review/SyncNotice.svelte";

  // compose the five domain stores once at the root and share them through context.
  const app = setAppState(createAppState());
  const { diff, ui } = app;

  onMount(() => {
    void diff.load();
    void app.review.load();
    app.review.startPolling();
    return () => app.review.stopPolling();
  });
</script>

<main class="flex h-dvh flex-col bg-bg font-sans text-text">
  {#if diff.state.status === "error"}
    <p role="alert" class="m-6 rounded-md border border-border bg-surface p-4 text-destructive">
      {diff.state.message}
    </p>
  {:else if diff.state.status === "ready"}
    <TopBar />
    <SyncNotice />
    <div class="relative flex min-h-0 flex-1">
      {#if ui.drawerOpen}
        <button class="fixed inset-0 z-20 bg-black/40 lg:hidden" aria-label="Close file browser" onclick={() => ui.closeDrawer()}></button>
      {/if}
      <FileIndex />
      <section class="min-w-0 flex-1 overflow-auto">
        <DiffView />
      </section>
    </div>
  {:else}
    <p role="status" class="p-6 font-mono text-sm text-muted">Loading the diff…</p>
  {/if}
</main>
