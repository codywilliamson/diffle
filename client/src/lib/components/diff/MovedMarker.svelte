<script lang="ts">
  import type { MovedMark } from "$lib/diff/movedLines";
  import { getAppState } from "$lib/state/context";

  let { mark }: { mark: MovedMark } = $props();
  const { ui } = getAppState();
</script>

<span class="moved-anchor">
  <button type="button" class="moved-label" title="Go to {mark.file}" onclick={() => ui.selectFile(mark.file)}>{mark.label}</button>
</span>
