<script lang="ts">
  let { onSend, onDone }: { onSend: (text: string) => Promise<void>; onDone: () => void } = $props();

  let text = $state("");
  let pending = $state(false);
  let input = $state<HTMLTextAreaElement>();

  $effect(() => input?.focus());

  async function submit(): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    pending = true;
    await onSend(trimmed);
    pending = false;
    onDone();
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

<div class="mt-2 rounded-md border border-border bg-surface-2 p-3">
  <textarea
    bind:this={input}
    bind:value={text}
    onkeydown={onKeydown}
    aria-label="Reply"
    placeholder="Reply…"
    class="min-h-[2rem] w-full resize-none bg-transparent font-sans text-sm text-text outline-none placeholder:text-dim"
  ></textarea>
  <div class="mt-3 flex gap-2">
    <button class="rounded bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50" onclick={submit} disabled={!text.trim() || pending}>Send</button>
    <button class="rounded px-2.5 py-1 text-xs text-muted hover:text-text" onclick={onDone} disabled={pending}>Cancel</button>
  </div>
</div>
