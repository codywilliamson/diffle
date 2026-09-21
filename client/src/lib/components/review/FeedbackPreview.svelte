<script lang="ts">
  import Modal from "../Modal.svelte";
  import { getAppState } from "$lib/state/context";
  import { compile } from "$lib/api/meta";
  import { renderMarkdown } from "$lib/diff/markdown";

  const { ui } = getAppState();

  let prompt = $state("");
  let status = $state<"loading" | "ready" | "error">("loading");
  let view = $state<"rendered" | "raw">("rendered");
  let copied = $state(false);
  let raw = $state<HTMLTextAreaElement>();

  compile()
    .then((r) => {
      prompt = r.prompt;
      status = "ready";
    })
    .catch(() => (status = "error"));

  // focus + select the textarea whenever raw view is shown, so ctrl+a-c is one step.
  $effect(() => {
    if (view === "raw") raw?.select();
  });

  function selectRaw(): void {
    view = "raw";
    queueMicrotask(() => raw?.select());
  }

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(prompt);
      copied = true;
      setTimeout(() => (copied = false), 1500);
    } catch {
      selectRaw();
    }
  }
</script>

<Modal title="Feedback preview" onClose={() => ui.closeOverlay()}>
  {#if status === "loading"}
    <p role="status" class="text-sm text-muted">Compiling feedback…</p>
  {:else if status === "error"}
    <p role="alert" class="text-sm text-destructive">Failed to compile feedback.</p>
  {:else}
    <div class="mb-3 flex items-center gap-2">
      <div class="flex rounded-md border border-border bg-surface-2 p-0.5 text-xs">
        <button
          class="rounded px-2 py-1 {view === 'rendered' ? 'bg-surface text-text' : 'text-muted hover:text-text'}"
          onclick={() => (view = "rendered")}
        >Rendered</button>
        <button
          class="rounded px-2 py-1 {view === 'raw' ? 'bg-surface text-text' : 'text-muted hover:text-text'}"
          onclick={() => (view = "raw")}
        >Raw</button>
      </div>
      <button
        class="ml-auto rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground"
        onclick={copy}
      >{copied ? "Copied" : "Copy Markdown"}</button>
    </div>
    {#if view === "rendered"}
      <div class="markdown-body max-h-[60vh] overflow-auto">{@html renderMarkdown(prompt, "feedback.md")}</div>
    {:else}
      <textarea
        bind:this={raw}
        readonly
        value={prompt}
        aria-label="Raw feedback markdown"
        class="h-72 w-full resize-none rounded-md border border-border bg-surface-2 p-2 font-mono text-xs text-text outline-none focus:border-focus"
      ></textarea>
    {/if}
  {/if}
</Modal>
