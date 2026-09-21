<script lang="ts">
  // pointer-capture drag with rAF-batched updates. onResize fires per frame for a live width;
  // onCommit fires once on release so persistence (localStorage) never runs mid-drag — the two
  // sources of the old jank were the per-move localStorage write and losing the mouse off-handle.
  const { onResize, onCommit }: { onResize: (x: number) => void; onCommit: () => void } = $props();

  let dragging = false;
  let raf = 0;
  let lastX = 0;

  function flush(): void {
    raf = 0;
    onResize(lastX);
  }

  function onMove(e: PointerEvent): void {
    if (!dragging) return;
    lastX = e.clientX;
    if (!raf) raf = requestAnimationFrame(flush);
  }

  function endDrag(e: PointerEvent): void {
    if (!dragging) return;
    dragging = false;
    if (raf) cancelAnimationFrame(raf), (raf = 0);
    (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
    onResize(e.clientX);
    onCommit();
  }

  function onDown(e: PointerEvent): void {
    e.preventDefault();
    dragging = true;
    lastX = e.clientX;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  class="absolute inset-y-0 right-0 w-1.5 cursor-col-resize hover:bg-focus"
  role="separator"
  aria-orientation="vertical"
  aria-label="Resize sidebar"
  onpointerdown={onDown}
  onpointermove={onMove}
  onpointerup={endDrag}
  onpointercancel={endDrag}
></div>
