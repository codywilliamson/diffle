<script lang="ts">
  let { on, onToggle }: { on: boolean; onToggle: () => void } = $props();
</script>

<span class="chip chip-changed">Changed since last review</span>
<button
  type="button"
  class="chip-btn"
  aria-pressed={on}
  title="Show only changes since last review"
  onclick={onToggle}
>{on ? "Showing changes since review" : "Show only changes since last review"}</button>
