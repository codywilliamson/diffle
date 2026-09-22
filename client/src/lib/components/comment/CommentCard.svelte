<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import Trash from "@lucide/svelte/icons/trash-2";
  import type { Comment } from "$types";
  import { getAppState } from "$lib/state/context";
  import { relativeTime } from "$lib/format";
  import CommentEditor from "./CommentEditor.svelte";
  import CommentReplies from "./CommentReplies.svelte";
  import ReplyComposer from "./ReplyComposer.svelte";

  let { comment }: { comment: Comment } = $props();
  const { comments, review } = getAppState();

  let editing = $state(false);
  let replying = $state(false);

  const status = $derived(comment.status ?? (comment.resolved ? "resolved" : "open"));
  const resolved = $derived(status === "resolved");
</script>

{#if editing}
  <CommentEditor
    initial={comment.text}
    initialTag={comment.tag}
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
      <span class="-mr-2 ml-auto flex items-center gap-0.5">
        <button class="comment-btn" onclick={() => (resolved ? comments.reopen(comment.id) : comments.resolve(comment.id))}>{resolved ? "Reopen" : "Resolve"}</button>
        {#if !resolved}<button class="comment-btn" onclick={() => (editing = true)}>Edit</button>{/if}
        {#if !review.isLegacy && !resolved}<button class="comment-btn" onclick={() => (replying = true)}>Reply</button>{/if}
        <span class="mx-1 h-4 w-px bg-border" aria-hidden="true"></span>
        <button class="comment-btn comment-btn-danger" onclick={() => comments.remove(comment.id)}><Trash size={12} aria-hidden="true" />Delete</button>
      </span>
    </div>
    <div class="comment-body mt-1 whitespace-pre-wrap">{comment.text}</div>
    {#if comment.replies?.length}<CommentReplies replies={comment.replies} />{/if}
    {#if replying && !resolved}
      <ReplyComposer onSend={(text) => comments.reply(comment.id, text)} onDone={() => (replying = false)} />
    {/if}
  </div>
{/if}
