<script lang="ts">
  import ComposerHint from "./ComposerHint.svelte";

  let { onSend, onDone }: { onSend: (text: string) => Promise<string | null>; onDone: () => void } = $props();

  let text = $state("");
  let pending = $state(false);
  let sendError = $state<string | null>(null);
  let input = $state<HTMLTextAreaElement>();
  const hintId = $props.id();

  $effect(() => input?.focus());

  async function submit(): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    pending = true;
    sendError = null;
    try {
      sendError = await onSend(trimmed);
      if (!sendError) onDone();
    } catch (error) {
      sendError = error instanceof Error ? error.message : String(error);
    } finally {
      pending = false;
    }
  }
  function onKeydown(e: KeyboardEvent): void {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onDone();
    } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void submit();
    }
  }
</script>

<div class="composer @container mt-2">
  <textarea
    bind:this={input}
    bind:value={text}
    onkeydown={onKeydown}
    rows="2"
    aria-label="Reply"
    aria-describedby={hintId}
    placeholder="Reply…"
    class="composer-input"
  ></textarea>
  <div class="mt-2 flex flex-wrap items-center gap-2">
    <button class="comment-btn comment-btn-primary" onclick={submit} disabled={!text.trim() || pending}>{pending ? "Sending…" : "Send"}</button>
    <button class="comment-btn" onclick={onDone} disabled={pending}>Cancel</button>
    <ComposerHint id={hintId} action="send" class="@max-md:hidden" />
  </div>
  {#if sendError}<p role="alert" class="mt-2 text-xs text-destructive">{sendError}</p>{/if}
</div>
