<script lang="ts">
  import type { Comment } from "$types";
  import CommentCard from "./CommentCard.svelte";

  let { comments }: { comments: Comment[] } = $props();
</script>

<div class="flex flex-col gap-2">
  {#each comments as comment (comment.id)}
    <CommentCard {comment} />
  {/each}
</div>
