<script lang="ts">
  import { onMount } from "svelte";
  import type { DiffResult } from "$types";
  import { getDiff } from "$lib/api/diff";

  type ShellState =
    | { status: "loading" }
    | { status: "ready"; diff: DiffResult }
    | { status: "error"; message: string };

  let state = $state<ShellState>({ status: "loading" });

  onMount(() => {
    getDiff()
      .then((diff) => (state = { status: "ready", diff }))
      .catch((err) => (state = { status: "error", message: err instanceof Error ? err.message : String(err) }));
  });

  const fileCount = (diff: DiffResult) => `${diff.files.length} ${diff.files.length === 1 ? "file" : "files"}`;
</script>

<main class="min-h-dvh bg-bg font-sans text-text">
  {#if state.status === "loading"}
    <p role="status" class="p-6 font-mono text-sm text-muted">Loading the diff…</p>
  {:else if state.status === "error"}
    <p role="alert" class="m-6 rounded-md border border-border bg-surface p-4 text-destructive">
      {state.message}
    </p>
  {:else}
    <header class="flex items-baseline gap-3 border-b border-divider bg-surface px-6 py-4">
      <h1 class="font-serif text-2xl text-accent">diffle</h1>
      <p class="font-mono text-sm text-muted">{state.diff.ref}</p>
      <p class="ml-auto font-mono text-sm text-dim">{fileCount(state.diff)}</p>
    </header>
  {/if}
</main>
