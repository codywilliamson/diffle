<script lang="ts">
  import { tick, untrack } from "svelte";
  import Check from "@lucide/svelte/icons/check";
  import type { CommentTag } from "$types";
  import ComposerHint from "./ComposerHint.svelte";
  import { focusDiff, revealInDiff } from "$lib/diff/focusDiff";
  import { suggestionFence } from "$lib/suggestions";

  let {
    initial = "",
    initialTag,
    suggestLines,
    onSave,
    onCancel,
  }: {
    initial?: string;
    initialTag?: CommentTag;
    suggestLines?: string[]; // new-side lines under a line or range comment; enables Suggest change
    onSave: (text: string, tag?: CommentTag) => Promise<string | null>;
    onCancel: () => void;
  } = $props();

  const TAGS: CommentTag[] = ["nit", "issue", "question", "praise"];
  const SUGGEST_KEY = "g";
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
  // focus without the browser's own scroll (it can leave the editor under the sticky header),
  // then bring the editor fully into view.
  $effect(() => {
    if (!ta) return;
    ta.focus({ preventScroll: true });
    revealInDiff(ta.closest<HTMLElement>(".composer") ?? ta);
  });

  // closing hands focus back to the diff, so the keys work again and the cursor is where it was
  function cancel(): void {
    onCancel();
    focusDiff();
  }

  async function submit(): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed || saving) return;
    saving = true;
    saveError = null;
    try {
      saveError = await onSave(trimmed, tag);
      if (!saveError) focusDiff();
    } catch (error) {
      saveError = error instanceof Error ? error.message : String(error);
    } finally {
      saving = false;
    }
  }
  // drops a suggestion fence prefilled with the anchored lines at the caret, caret ends inside it
  async function suggestChange(): Promise<void> {
    if (!suggestLines || !ta) return;
    const at = ta.selectionStart ?? text.length;
    const before = text.slice(0, at);
    const after = text.slice(at);
    const fence = suggestionFence(suggestLines);
    const inserted = `${before && !before.endsWith("\n") ? "\n" : ""}${fence}${after && !after.startsWith("\n") ? "\n" : ""}`;
    text = before + inserted + after;
    await tick();
    const caret = before.length + inserted.length - (after && !after.startsWith("\n") ? 1 : 0);
    ta.focus({ preventScroll: true });
    ta.setSelectionRange(caret, caret);
  }
  function onKeydown(e: KeyboardEvent): void {
    if (e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === SUGGEST_KEY && suggestLines) {
      e.preventDefault();
      void suggestChange();
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      cancel();
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
    <button class="comment-btn" onclick={cancel}>Cancel</button>
    {#if suggestLines}<button type="button" class="comment-btn" onclick={() => void suggestChange()} aria-keyshortcuts="Control+G">Suggest change</button>{/if}
    <ComposerHint id={hintId} action="save" suggest={!!suggestLines} class="@max-2xl:hidden" />
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
