<script lang="ts">
  const { onResize }: { onResize: (x: number) => void } = $props();

  function onMove(e: MouseEvent) {
    onResize(e.clientX);
  }

  function onUp() {
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
    document.body.style.userSelect = "";
  }

  function onDown(e: MouseEvent) {
    e.preventDefault();
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  class="absolute inset-y-0 right-0 w-1 cursor-col-resize hover:bg-border"
  role="separator"
  aria-orientation="vertical"
  aria-label="Resize sidebar"
  onmousedown={onDown}
></div>
