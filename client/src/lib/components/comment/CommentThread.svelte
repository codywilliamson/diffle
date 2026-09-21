<script lang="ts">
  import { flip } from "svelte/animate";
  import type { Comment } from "$types";
  import CommentCard from "./CommentCard.svelte";
  import { fly, FLIP } from "$lib/motion";

  let { comments }: { comments: Comment[] } = $props();
</script>

<div class="flex flex-col gap-2">
  {#each comments as comment (comment.id)}
    <div in:fly={{ y: 4 }} animate:flip={FLIP}>
      <CommentCard {comment} />
    </div>
  {/each}
</div>
