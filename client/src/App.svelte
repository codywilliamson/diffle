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

<main>
  {#if state.status === "loading"}
    <p role="status">Loading the diff…</p>
  {:else if state.status === "error"}
    <p role="alert">{state.message}</p>
  {:else}
    <header>
      <h1>diffle</h1>
      <p>{state.diff.ref}</p>
      <p>{fileCount(state.diff)}</p>
    </header>
  {/if}
</main>
