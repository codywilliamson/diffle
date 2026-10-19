<script lang="ts">
  // a suggestion as a mini diff: the anchored lines removed, the suggested lines added.
  // lines render as text nodes only, never html.
  let { original, suggested }: { original: string[]; suggested: string[] } = $props();
</script>

<div class="suggestion" role="group" aria-label="Suggested change">
  <div class="suggestion-title">Suggested change</div>
  {#each original as line, i (`o${i}`)}
    <div class="suggestion-row row-deletion"><span class="suggestion-sign" aria-hidden="true">−</span><span class="suggestion-text">{line}</span><span class="sr-only">removed</span></div>
  {/each}
  {#each suggested as line, i (`s${i}`)}
    <div class="suggestion-row row-addition"><span class="suggestion-sign" aria-hidden="true">+</span><span class="suggestion-text">{line}</span><span class="sr-only">added</span></div>
  {/each}
  {#if suggested.length === 0}<div class="suggestion-note">These lines would be deleted.</div>{/if}
</div>
