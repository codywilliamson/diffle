<script lang="ts">
  import type { DiffFile } from "$types";
  import { getFile } from "$lib/api/meta";
  import { renderMarkdown } from "$lib/diff/markdown";

  let { file }: { file: DiffFile } = $props();

  type State = { status: "loading" } | { status: "ready"; html: string } | { status: "error"; message: string };
  let state = $state<State>({ status: "loading" });

  $effect(() => {
    let cancelled = false;
    getFile(file.path)
      .then((r) => {
        if (!cancelled) state = { status: "ready", html: renderMarkdown(r.content, file.path) };
      })
      .catch((e) => {
        if (!cancelled) state = { status: "error", message: e instanceof Error ? e.message : String(e) };
      });
    return () => {
      cancelled = true;
    };
  });
</script>

{#if state.status === "loading"}
  <p class="p-4 text-sm text-muted">Rendering…</p>
{:else if state.status === "error"}
  <p class="p-4 text-sm text-destructive">{state.message}</p>
{:else}
  <!-- html is sanitized in renderMarkdown (DOMPurify, ADR 0007) -->
  <div class="markdown-body p-4">{@html state.html}</div>
{/if}
