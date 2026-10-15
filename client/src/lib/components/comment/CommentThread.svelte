<script lang="ts">
  import { flip } from "svelte/animate";
  import ChevronUp from "@lucide/svelte/icons/chevron-up";
  import type { Comment } from "$types";
  import CommentCard from "./CommentCard.svelte";
  import { fly, FLIP } from "$lib/motion";

  // onHide: line threads collapse to a pip on their line; file-level threads pass nothing.
  let { comments, onHide }: { comments: Comment[]; onHide?: () => void } = $props();
</script>

<div class="flex flex-col gap-2">
  {#if onHide}
    <div class="-mb-1 flex justify-end">
      <button type="button" class="comment-btn flex items-center gap-1 text-xs text-muted" title="Hide thread" aria-label="Hide thread" onclick={onHide}>
        <ChevronUp size={12} aria-hidden="true" />Hide
      </button>
    </div>
  {/if}
  {#each comments as comment (comment.id)}
    <div in:fly={{ y: 4 }} animate:flip={FLIP}>
      <CommentCard {comment} />
    </div>
  {/each}
</div>
