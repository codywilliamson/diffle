<script lang="ts">
  import { tick, untrack } from "svelte";
  import Check from "@lucide/svelte/icons/check";
  import type { CommentTag } from "$types";
  import { tryGetAppState } from "$lib/state/context";
  import ComposerHint from "./ComposerHint.svelte";
  import { focusDiff, revealInDiff } from "$lib/diff/focusDiff";
  import { suggestionFence } from "$lib/suggestions";
  import type { SuggestSource } from "$lib/diff/threads";

  let {
    initial = "",
    initialTag,
    suggest,
    draftKey,
    onSave,
    onCancel,
  }: {
    initial?: string;
    draftKey?: string; // where the unsent text is kept; closing the box keeps it, Cancel and a save drop it
    initialTag?: CommentTag;
    suggest?: SuggestSource; // new-side lines under a line or range comment; enables Suggest change
    onSave: (text: string, tag?: CommentTag) => Promise<string | null>;
    onCancel: () => void;
  } = $props();

  const blocked = $derived(tryGetAppState()?.connection.blockedReason ?? null);
  const TAGS: CommentTag[] = ["nit", "issue", "question", "praise"];
  const SUGGEST_KEY = "g";
  const hintId = $props.id();
  const drafts = tryGetAppState()?.drafts;
  const key = $derived(draftKey); // follows the anchor when shift-click grows the range; the store moves the text
  // seed once from the props (or the saved draft); the editor is mounted fresh per add/edit.
  let text = $state(untrack(() => (key && drafts?.get(key)) || initial));
  let remembered = untrack(() => text);
  let tag = $state<CommentTag | undefined>(untrack(() => initialTag));
  let ta = $state<HTMLTextAreaElement>();
  let saving = $state(false);
  let saveError = $state<string | null>(null);

  // drafts load on their own clock: an editor opened first picks the saved text up once it lands,
  // unless the reviewer has already typed (an untouched box never overwrites a saved draft)
  $effect(() => {
    if (!drafts?.loaded || !key || text !== remembered) return;
    const saved = drafts.get(key);
    if (saved !== undefined && saved !== text) {
      text = saved;
      remembered = saved;
    }
  });
  // every change goes to the draft store (it debounces the server write); the original text is no draft
  $effect(() => {
    if (!key || text === remembered) return;
    remembered = text;
    drafts?.set(key, text === initial ? "" : text);
  });
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
  function close(): void {
    onCancel();
    focusDiff();
  }
  // the Cancel button throws the draft away; Escape only closes the box
  function discard(): void {
    if (key) drafts?.clear(key);
    close();
  }

  async function submit(): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed || saving || blocked) return;
    saving = true;
    saveError = null;
    try {
      saveError = await onSave(trimmed, tag);
      if (!saveError) {
        if (key) drafts?.clear(key);
        focusDiff();
      }
    } catch (error) {
      saveError = error instanceof Error ? error.message : String(error);
    } finally {
      saving = false;
    }
  }
  // drops a suggestion fence prefilled with the anchored lines at the caret and selects the
  // prefilled replacement inside it, so typing replaces it
  async function suggestChange(): Promise<void> {
    const lines = suggest?.lines;
    if (!lines || !ta) return;
    const at = ta.selectionStart ?? text.length;
    const before = text.slice(0, at);
    const after = text.slice(at);
    const fence = suggestionFence(lines);
    const lead = before && !before.endsWith("\n") ? "\n" : "";
    const tail = after && !after.startsWith("\n") ? "\n" : "";
    text = before + lead + fence + tail + after;
    const contentStart = before.length + lead.length + fence.indexOf("\n") + 1;
    const contentEnd = contentStart + lines.join("\n").length;
    await tick();
    ta.focus({ preventScroll: true });
    ta.setSelectionRange(contentStart, contentEnd);
  }
  function onKeydown(e: KeyboardEvent): void {
    if (e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === SUGGEST_KEY && suggest?.lines) {
      e.preventDefault();
      void suggestChange();
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
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
    <button class="comment-btn comment-btn-primary" onclick={() => void submit()} disabled={!text.trim() || saving || !!blocked} title={blocked ?? undefined} aria-describedby={blocked ? `${hintId}-gone` : undefined}>{saving ? "Saving…" : "Save"}</button>
    <button class="comment-btn" onclick={discard}>Cancel</button>
    {#if suggest?.lines}
      <button type="button" class="comment-btn" onclick={() => void suggestChange()} aria-keyshortcuts="Control+G">Suggest change</button>
    {:else if suggest?.blocked}
      <button type="button" class="comment-btn" disabled aria-describedby="{hintId}-blocked">Suggest change</button>
      <span id="{hintId}-blocked" class="text-xs text-muted">{suggest.blocked}</span>
    {/if}
    <ComposerHint id={hintId} action="save" suggest={!!suggest?.lines} class="@max-2xl:hidden" />
    <div role="group" aria-label="Tag" class="ml-auto flex flex-wrap gap-1.5 @max-md:ml-0 @max-md:basis-full">
      {#each TAGS as t (t)}
        <button type="button" class="comment-tag" aria-pressed={tag === t} onclick={() => (tag = tag === t ? undefined : t)}>
          {#if tag === t}<Check size={12} strokeWidth={2.5} aria-hidden="true" />{/if}{t}
        </button>
      {/each}
    </div>
  </div>
  {#if blocked}<p id="{hintId}-gone" class="mt-2 text-xs text-destructive">{blocked}</p>{/if}
  {#if key && drafts?.rejection(key)}<p role="status" class="mt-2 text-xs text-destructive">Not saved as a draft: {drafts.rejection(key)}</p>{/if}
  {#if saveError}<p role="alert" class="mt-2 text-xs text-destructive">{saveError}</p>{/if}
</div>
