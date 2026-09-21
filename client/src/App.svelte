<script lang="ts">
  import { onMount } from "svelte";
  import { createAppState, setAppState } from "$lib/state/context";

  // compose the five domain stores once at the root and share them through context.
  const app = setAppState(createAppState());
  const diff = app.diff;

  onMount(() => {
    void diff.load();
    void app.review.load();
  });

  const fileCount = (n: number): string => `${n} ${n === 1 ? "file" : "files"}`;
</script>

<main class="min-h-dvh bg-bg font-sans text-text">
  {#if diff.state.status === "error"}
    <p role="alert" class="m-6 rounded-md border border-border bg-surface p-4 text-destructive">
      {diff.state.message}
    </p>
  {:else if diff.state.status === "ready"}
    <header class="flex items-baseline gap-3 border-b border-divider bg-surface px-6 py-4">
      <h1 class="font-serif text-2xl text-accent">diffle</h1>
      <p class="font-mono text-sm text-muted">{diff.ref}</p>
      <p class="ml-auto font-mono text-sm text-dim">{fileCount(diff.files.length)}</p>
    </header>
  {:else}
    <p role="status" class="p-6 font-mono text-sm text-muted">Loading the diff…</p>
  {/if}
</main>
