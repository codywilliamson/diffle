<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import Trash from "@lucide/svelte/icons/trash-2";
  import type { Comment } from "$types";
  import { getAppState } from "$lib/state/context";
  import { relativeTime } from "$lib/format";
  import CommentEditor from "./CommentEditor.svelte";
  import CommentReplies from "./CommentReplies.svelte";
  import ReplyComposer from "./ReplyComposer.svelte";
  import Markdown from "../Markdown.svelte";
  import SuggestionDiff from "./SuggestionDiff.svelte";
  import { parseSuggestions, type BodySegment } from "$lib/suggestions";
  import { anchoredLines, rangeEnd, sideOf } from "$lib/anchor";

  let { comment }: { comment: Comment } = $props();
  const { comments, review, diff } = getAppState();

  let editing = $state(false);
  let replying = $state(false);

  const status = $derived(comment.status ?? (comment.resolved ? "resolved" : "open"));
  const resolved = $derived(status === "resolved");

  // line and range comments show their suggestion fences as a diff against the anchored lines;
  // file-level comments render the body as written.
  const segments = $derived<BodySegment[]>(comment.line === null ? [{ kind: "prose", text: comment.text }] : parseSuggestions(comment.text));
  const original = $derived(
    comment.line === null
      ? []
      : anchoredLines(diff.files.find((file) => file.path === comment.file), sideOf(comment), comment.line, rangeEnd(comment)),
  );
</script>

{#if editing}
  <CommentEditor
    initial={comment.text}
    initialTag={comment.tag}
    suggestLines={sideOf(comment) === "new" && original.length > 0 ? original : undefined}
    onSave={async (text, tag) => {
      const error = await comments.edit(comment.id, { text, tag });
      if (!error) editing = false;
      return error;
    }}
    onCancel={() => (editing = false)}
  />
{:else}
  <div class="comment-card" class:resolved>
    <div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
      {#if resolved}<span class="comment-chip bg-surface-2"><Check size={12} strokeWidth={2.5} aria-hidden="true" />Resolved</span>{/if}
      {#if status === "addressed"}<span class="comment-chip bg-mod-badge-bg text-mod-badge-text">Addressed</span>{/if}
      {#if comment.tag}<span class="comment-chip comment-chip-tag">{comment.tag}</span>{/if}
      <time datetime={comment.createdAt}>{relativeTime(comment.createdAt)}</time>
      <span class="-mr-2 ml-auto flex min-w-0 flex-wrap items-center justify-end gap-0.5">
        <button class="comment-btn" onclick={() => (resolved ? comments.reopen(comment.id) : comments.resolve(comment.id))}>{resolved ? "Reopen" : "Resolve"}</button>
        {#if !resolved}<button class="comment-btn" onclick={() => (editing = true)}>Edit</button>{/if}
        {#if !review.isLegacy && !resolved}<button class="comment-btn" onclick={() => (replying = true)}>Reply</button>{/if}
        <span class="mx-1 h-4 w-px bg-border" aria-hidden="true"></span>
        <button class="comment-btn comment-btn-danger" onclick={() => comments.remove(comment.id)}><Trash size={12} aria-hidden="true" />Delete</button>
      </span>
    </div>
    {#each segments as segment, i (i)}
      {#if segment.kind === "suggestion"}
        <SuggestionDiff {original} suggested={segment.lines} />
      {:else}
        <Markdown text={segment.text} from={comment.file} class="comment-body mt-1" />
      {/if}
    {/each}
    {#if comment.replies?.length}<CommentReplies replies={comment.replies} from={comment.file} />{/if}
    {#if replying && !resolved}
      <ReplyComposer onSend={(text) => comments.reply(comment.id, text)} onDone={() => (replying = false)} />
    {/if}
  </div>
{/if}
