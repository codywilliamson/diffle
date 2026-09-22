<script lang="ts">
  import type { CommentReply } from "$types";
  import { relativeTime } from "$lib/format";

  let { replies }: { replies: CommentReply[] } = $props();
</script>

<div class="mt-2 flex flex-col gap-2 border-l border-border pl-3">
  {#each replies as reply (reply.id)}
    <div>
      <div class="text-xs text-muted">
        <span class="font-medium">{reply.author}</span> · <time datetime={reply.createdAt}>{relativeTime(reply.createdAt)}</time>
      </div>
      <div class="whitespace-pre-wrap">{reply.text}</div>
    </div>
  {/each}
</div>
