<script lang="ts">
  import { untrack } from "svelte";
  import Check from "@lucide/svelte/icons/check";
  import type { CommentTag } from "$types";
  import ComposerHint from "./ComposerHint.svelte";

  let {
    initial = "",
    initialTag,
    onSave,
    onCancel,
  }: {
    initial?: string;
    initialTag?: CommentTag;
    onSave: (text: string, tag?: CommentTag) => Promise<string | null>;
    onCancel: () => void;
  } = $props();

  const TAGS: CommentTag[] = ["nit", "issue", "question", "praise"];
  const hintId = $props.id();
  // seed once from the props; the editor is mounted fresh per add/edit.
  let text = $state(untrack(() => initial));
  let tag = $state<CommentTag | undefined>(untrack(() => initialTag));
  let ta = $state<HTMLTextAreaElement>();
  let saving = $state(false);
  let saveError = $state<string | null>(null);

  // grow the textarea with its content, and focus it on mount.
  $effect(() => {
    void text;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = `${ta.scrollHeight}px`;
    }
  });
  $effect(() => ta?.focus());

  async function submit(): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed || saving) return;
    saving = true;
    saveError = null;
    try {
      saveError = await onSave(trimmed, tag);
    } catch (error) {
      saveError = error instanceof Error ? error.message : String(error);
    } finally {
      saving = false;
    }
  }
  function onKeydown(e: KeyboardEvent): void {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onCancel();
    } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void submit();
    }
  }
</script>

<div class="composer @container">
  <textarea
    bind:this={ta}
    bind:value={text}
    onkeydown={onKeydown}
    rows="2"
    aria-label="Comment text"
    aria-describedby={hintId}
    placeholder="Leave a comment…"
    class="composer-input"
  ></textarea>
  <div class="mt-2 flex flex-wrap items-center gap-2">
    <button class="comment-btn comment-btn-primary" onclick={() => void submit()} disabled={!text.trim() || saving}>{saving ? "Saving…" : "Save"}</button>
    <button class="comment-btn" onclick={onCancel}>Cancel</button>
    <ComposerHint id={hintId} action="save" class="@max-2xl:hidden" />
    <div role="group" aria-label="Tag" class="ml-auto flex flex-wrap gap-1.5 @max-md:ml-0 @max-md:basis-full">
      {#each TAGS as t (t)}
        <button type="button" class="comment-tag" aria-pressed={tag === t} onclick={() => (tag = tag === t ? undefined : t)}>
          {#if tag === t}<Check size={12} strokeWidth={2.5} aria-hidden="true" />{/if}{t}
        </button>
      {/each}
    </div>
  </div>
  {#if saveError}<p role="alert" class="mt-2 text-xs text-destructive">{saveError}</p>{/if}
</div>
