<script lang="ts">
  import { untrack } from "svelte";
  import { tryGetAppState } from "$lib/state/context";
  import ComposerHint from "./ComposerHint.svelte";

  let { onSend, onDone, draftKey }: { onSend: (text: string) => Promise<string | null>; onDone: () => void; draftKey?: string } = $props();

  const drafts = tryGetAppState()?.drafts;
  let text = $state(untrack(() => (draftKey && drafts?.get(draftKey)) || ""));
  let remembered = untrack(() => text);
  let pending = $state(false);
  let sendError = $state<string | null>(null);
  let input = $state<HTMLTextAreaElement>();
  const hintId = $props.id();
  const blocked = $derived(tryGetAppState()?.connection.blockedReason ?? null);

  $effect(() => input?.focus());
  // an untouched box picks the saved draft up if it loads after this opened
  $effect(() => {
    if (!drafts?.loaded || !draftKey || text !== remembered) return;
    const saved = drafts.get(draftKey);
    if (saved !== undefined && saved !== text) {
      text = saved;
      remembered = saved;
    }
  });
  // every change goes to the draft store; Escape closes and keeps it, Cancel and a send drop it
  $effect(() => {
    if (!draftKey || text === remembered) return;
    remembered = text;
    drafts?.set(draftKey, text);
  });
  function discard(): void {
    if (draftKey) drafts?.clear(draftKey);
    onDone();
  }

  async function submit(): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed || pending || blocked) return;
    pending = true;
    sendError = null;
    try {
      sendError = await onSend(trimmed);
      if (!sendError) discard();
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
    <button class="comment-btn comment-btn-primary" onclick={submit} disabled={!text.trim() || pending || !!blocked} title={blocked ?? undefined}>{pending ? "Sending…" : "Send"}</button>
    <button class="comment-btn" onclick={discard} disabled={pending}>Cancel</button>
    <ComposerHint id={hintId} action="send" class="@max-md:hidden" />
  </div>
  {#if draftKey && drafts?.rejection(draftKey)}<p role="status" class="mt-2 text-xs text-destructive">Not saved as a draft: {drafts.rejection(draftKey)}</p>{/if}
  {#if sendError}<p role="alert" class="mt-2 text-xs text-destructive">{sendError}</p>{/if}
</div>
