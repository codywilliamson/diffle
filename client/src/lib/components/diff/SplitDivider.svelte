<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import GripVertical from "@lucide/svelte/icons/grip-vertical";
  import { MIN_SPLIT_RATIO, clampSplitRatio } from "$lib/diff/splitRatio";

  let { value, controls, onResize, onCommit }: {
    value: number; controls: string; onResize: (ratio: number) => void; onCommit: () => void;
  } = $props();
  let handle: HTMLDivElement;
  let pointer: number | null = null;
  let raf = 0;
  let lastX = 0;
  const MIN_PANE_WIDTH = 120;
  let minimum = $state(MIN_SPLIT_RATIO);
  let maximum = $derived(100 - minimum);
  function bounded(next: number): number { return Math.min(maximum, Math.max(minimum, clampSplitRatio(next))); }
  onMount(() => {
    const observer = new ResizeObserver(() => {
      const width = handle.parentElement!.clientWidth - handle.offsetWidth;
      minimum = Math.min(50, Math.max(MIN_SPLIT_RATIO, MIN_PANE_WIDTH / Math.max(1, width) * 100));
      onResize(bounded(value));
    });
    observer.observe(handle.parentElement!);
    return () => observer.disconnect();
  });

  function flush(): void {
    raf = 0;
    const bounds = handle.parentElement!.getBoundingClientRect();
    onResize(bounded((lastX - bounds.left - handle.offsetWidth / 2) / (bounds.width - handle.offsetWidth) * 100));
  }
  function down(event: PointerEvent): void {
    if (!event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    pointer = event.pointerId;
    handle.focus();
    handle.setPointerCapture(pointer);
    handle.parentElement?.classList.add("resizing");
  }
  function move(event: PointerEvent): void {
    if (event.pointerId !== pointer) return;
    lastX = event.clientX;
    if (!raf) raf = requestAnimationFrame(flush);
  }
  function end(event: PointerEvent): void {
    if (event.pointerId !== pointer) return;
    if (raf) cancelAnimationFrame(raf), (raf = 0);
    if (event.type === "pointerup") { lastX = event.clientX; flush(); }
    pointer = null;
    handle.parentElement?.classList.remove("resizing");
    if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
    onCommit();
  }
  function key(event: KeyboardEvent): void {
    const step = event.shiftKey ? 10 : 2;
    const next = event.key === "ArrowLeft" ? value - step : event.key === "ArrowRight" ? value + step
      : event.key === "Home" ? minimum : event.key === "End" ? maximum
      : event.key === "Enter" ? 50 : null;
    if (next == null) return;
    event.preventDefault();
    event.stopPropagation();
    onResize(bounded(next));
    onCommit();
  }
  function reset(): void { onResize(50); onCommit(); }
  onDestroy(() => { cancelAnimationFrame(raf); handle?.parentElement?.classList.remove("resizing"); });
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_no_noninteractive_tabindex (focusable ARIA window splitter) -->
<div bind:this={handle} class="split-divider" role="separator" tabindex="0" aria-label="Old version pane width"
  aria-controls={controls} aria-orientation="vertical" aria-valuemin={minimum} aria-valuemax={maximum}
  aria-valuenow={Math.round(value)} aria-valuetext="{Math.round(value)}% old, {Math.round(100 - value)}% new"
  title="Drag to resize · Arrow keys to adjust · Double-click or Enter to reset"
  onpointerdown={down} onpointermove={move} onpointerup={end} onpointercancel={end} onlostpointercapture={end}
  onkeydown={key} ondblclick={reset}><span><GripVertical size={12} /></span></div>
