<script lang="ts">
  import type { ActivityNotice } from "$lib/state/reviewRecord";
  import { getAppState } from "$lib/state/context";

  const { review, diff } = getAppState();
  const notice = $derived(review.notice);

  function summarize(n: ActivityNotice): string {
    const bits: string[] = [];
    if (n.replies) bits.push(`${n.replies} repl${n.replies === 1 ? "y" : "ies"}`);
    if (n.addressed) bits.push(`${n.addressed} addressed`);
    if (n.rereview) bits.push("rereview requested");
    return bits.join(", ");
  }
</script>

{#if notice}
  <div class="flex items-center gap-3 border-b border-divider bg-surface-2 px-4 py-2 text-sm">
    <span class="text-text">Agent activity: {summarize(notice)}{#if notice.summary} — “{notice.summary}”{/if}</span>
    <button class="ml-auto rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground" onclick={() => { void diff.refresh(); review.dismiss(); }}>Refresh diff</button>
    <button class="rounded px-2 py-1 text-xs text-muted hover:text-text" onclick={() => review.dismiss()}>Dismiss</button>
  </div>
{/if}
