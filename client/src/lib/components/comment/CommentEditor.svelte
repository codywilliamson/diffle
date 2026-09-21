<script lang="ts">
  import { untrack } from "svelte";
  import type { CommentTag } from "$types";

  let {
    initial = "",
    initialTag,
    onSave,
    onCancel,
  }: {
    initial?: string;
    initialTag?: CommentTag;
    onSave: (text: string, tag?: CommentTag) => void;
    onCancel: () => void;
  } = $props();

  const TAGS: CommentTag[] = ["nit", "issue", "question", "praise"];
  // seed once from the props; the editor is mounted fresh per add/edit.
  let text = $state(untrack(() => initial));
  let tag = $state<CommentTag | undefined>(untrack(() => initialTag));
  let ta = $state<HTMLTextAreaElement>();

  // grow the textarea with its content, and focus it on mount.
  $effect(() => {
    void text;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = `${ta.scrollHeight}px`;
    }
  });
  $effect(() => ta?.focus());

  function submit(): void {
    const trimmed = text.trim();
    if (trimmed) onSave(trimmed, tag);
  }
  function onKeydown(e: KeyboardEvent): void {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onCancel();
    } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      submit();
    }
  }
</script>

<div class="rounded-md border border-focus bg-surface p-2">
  <textarea
    bind:this={ta}
    bind:value={text}
    onkeydown={onKeydown}
    aria-label="Comment text"
    placeholder="Leave a comment…"
    class="min-h-[2.5rem] w-full resize-none bg-transparent font-sans text-sm text-text outline-none placeholder:text-dim"
  ></textarea>
  <div class="mt-2 flex flex-wrap items-center gap-2">
    <button class="rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50" onclick={submit} disabled={!text.trim()}>Save</button>
    <button class="rounded px-2 py-1 text-xs text-muted hover:text-text" onclick={onCancel}>Cancel</button>
    <div class="ml-auto flex gap-1">
      {#each TAGS as t (t)}
        <button
          type="button"
          class="rounded-full border px-1.5 text-[10px] {tag === t ? 'border-accent text-accent' : 'border-border text-dim hover:text-muted'}"
          onclick={() => (tag = tag === t ? undefined : t)}
        >{t}</button>
      {/each}
    </div>
  </div>
</div>
