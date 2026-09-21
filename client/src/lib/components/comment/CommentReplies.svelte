<script lang="ts">
  import type { CommentReply } from "$types";
  import { relativeTime } from "$lib/format";

  let { replies }: { replies: CommentReply[] } = $props();
</script>

<div class="mt-2 flex flex-col gap-2 border-l border-divider pl-2">
  {#each replies as reply (reply.id)}
    <div class="text-sm">
      <div class="text-[11px] text-dim">
        <span class="text-muted">{reply.author}</span> · {relativeTime(reply.createdAt)}
      </div>
      <div class="whitespace-pre-wrap text-text">{reply.text}</div>
    </div>
  {/each}
</div>
