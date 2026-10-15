<script lang="ts">
  import MessageSquare from "@lucide/svelte/icons/message-square";
  import type { Comment } from "$types";
  import { isResolved } from "$lib/state/reviewRecord";

  // a collapsed line thread: no row of its own, just a pip at the right edge of its line.
  let { comments, onExpand }: { comments: Comment[]; onExpand: () => void } = $props();

  const messages = $derived(comments.reduce((n, c) => n + 1 + (c.replies?.length ?? 0), 0));
  const resolved = $derived(comments.every(isResolved));
  const label = $derived(`Show ${resolved ? "resolved " : ""}thread (${messages} message${messages === 1 ? "" : "s"})`);
</script>

<span class="thread-pip-anchor">
  <button type="button" class="thread-pip" class:resolved title={label} aria-label={label} onclick={onExpand}>
    <MessageSquare size={11} aria-hidden="true" />{messages}
  </button>
</span>
