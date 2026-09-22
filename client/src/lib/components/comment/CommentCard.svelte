<script lang="ts">
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
  <div class="rounded-md border border-border bg-surface p-2 text-sm {resolved ? 'opacity-60' : ''}">
    <div class="mb-1 flex flex-wrap items-center gap-2 text-[11px] text-dim">
      {#if resolved}<span class="rounded bg-surface-2 px-1.5 text-muted">Resolved</span>{/if}
      {#if status === "addressed"}<span class="rounded bg-mod-badge-bg px-1.5 text-mod-badge-text">Addressed</span>{/if}
      {#if comment.tag}<span class="rounded-full border border-border px-1.5 text-accent">{comment.tag}</span>{/if}
      <span>{relativeTime(comment.createdAt)}</span>
      <span class="ml-auto flex gap-2">
        <button class="hover:text-text" onclick={() => (resolved ? comments.reopen(comment.id) : comments.resolve(comment.id))}>{resolved ? "Reopen" : "Resolve"}</button>
        {#if !resolved}<button class="hover:text-text" onclick={() => (editing = true)}>Edit</button>{/if}
        {#if !review.isLegacy && !resolved}<button class="hover:text-text" onclick={() => (replying = true)}>Reply</button>{/if}
        <button class="hover:text-destructive" onclick={() => comments.remove(comment.id)}>Delete</button>
      </span>
    </div>
    <div class="whitespace-pre-wrap font-sans text-text">{comment.text}</div>
    {#if comment.replies?.length}<CommentReplies replies={comment.replies} />{/if}
    {#if replying && !resolved}
      <ReplyComposer onSend={(text) => comments.reply(comment.id, text)} onDone={() => (replying = false)} />
    {/if}
  </div>
{/if}
