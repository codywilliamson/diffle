<script lang="ts">
  import { renderMarkdown } from "$lib/diff/markdown";

  // chat-style markdown (comments, replies, agent updates). `from` resolves relative image paths.
  let { text, from = "", class: className = "" }: { text: string; from?: string; class?: string } = $props();
</script>

<!-- html is sanitized in renderMarkdown (DOMPurify, ADR 0007) -->
<div class="markdown-body markdown-compact {className}">{@html renderMarkdown(text, from, { breaks: true })}</div>
