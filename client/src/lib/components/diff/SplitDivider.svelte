<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import GripVertical from "@lucide/svelte/icons/grip-vertical";
  import { DEFAULT_SPLIT_RATIO, MIN_SPLIT_RATIO, clampSplitRatio } from "$lib/diff/splitRatio";

  interface Props {
    value: number;
    controls: string;
    onResize: (ratio: number) => void;
    onCommit: () => void;
  }
  const MIN_PANE_WIDTH = 120;
  const KEYBOARD_STEP = 2;
  const LARGE_KEYBOARD_STEP = 10;

  let { value, controls, onResize, onCommit }: Props = $props();
  let handle: HTMLDivElement;
  let activePointer: number | null = null;
  let pendingFrame = 0;
  let pointerX = 0;
  let minimum = $state(MIN_SPLIT_RATIO);
  const maximum = $derived(100 - minimum);

  function constrainRatio(next: number): number {
    return Math.min(maximum, Math.max(minimum, clampSplitRatio(next)));
  }

  onMount(() => {
    const container = handle.parentElement!;
    const observer = new ResizeObserver(() => {
      const availableWidth = Math.max(1, container.clientWidth - handle.offsetWidth);
      const minimumWidthRatio = MIN_PANE_WIDTH / availableWidth * 100;
      minimum = Math.min(DEFAULT_SPLIT_RATIO, Math.max(MIN_SPLIT_RATIO, minimumWidthRatio));
      onResize(constrainRatio(value));
    });
    observer.observe(container);
    return () => observer.disconnect();
  });

  function applyPointerPosition(): void {
    pendingFrame = 0;
    const bounds = handle.parentElement!.getBoundingClientRect();
    const availableWidth = bounds.width - handle.offsetWidth;
    const oldPaneWidth = pointerX - bounds.left - handle.offsetWidth / 2;
    const nextRatio = oldPaneWidth / availableWidth * 100;
    onResize(constrainRatio(nextRatio));
  }

  function startDrag(event: PointerEvent): void {
    if (!event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    activePointer = event.pointerId;
    handle.focus();
    handle.setPointerCapture(activePointer);
    handle.parentElement?.classList.add("resizing");
  }

  function moveDivider(event: PointerEvent): void {
    if (event.pointerId !== activePointer) return;
    pointerX = event.clientX;
    if (!pendingFrame) {
      pendingFrame = requestAnimationFrame(applyPointerPosition);
    }
  }

  function endDrag(event: PointerEvent): void {
    if (event.pointerId !== activePointer) return;
    cancelAnimationFrame(pendingFrame);
    pendingFrame = 0;
    if (event.type === "pointerup") {
      pointerX = event.clientX;
      applyPointerPosition();
    }

    activePointer = null;
    handle.parentElement?.classList.remove("resizing");
    if (handle.hasPointerCapture(event.pointerId)) {
      handle.releasePointerCapture(event.pointerId);
    }
    onCommit();
  }

  function resizeWithKeyboard(event: KeyboardEvent): void {
    const step = event.shiftKey ? LARGE_KEYBOARD_STEP : KEYBOARD_STEP;
    let nextRatio: number;
    switch (event.key) {
      case "ArrowLeft":
        nextRatio = value - step;
        break;
      case "ArrowRight":
        nextRatio = value + step;
        break;
      case "Home":
        nextRatio = minimum;
        break;
      case "End":
        nextRatio = maximum;
        break;
      case "Enter":
        nextRatio = DEFAULT_SPLIT_RATIO;
        break;
      default:
        return;
    }

    event.preventDefault();
    event.stopPropagation();
    onResize(constrainRatio(nextRatio));
    onCommit();
  }

  function resetWidth(): void {
    onResize(DEFAULT_SPLIT_RATIO);
    onCommit();
  }

  onDestroy(() => {
    cancelAnimationFrame(pendingFrame);
    handle?.parentElement?.classList.remove("resizing");
  });
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_no_noninteractive_tabindex (focusable ARIA window splitter) -->
<div
  bind:this={handle}
  class="split-divider"
  role="separator"
  tabindex="0"
  aria-label="Old version pane width"
  aria-controls={controls}
  aria-orientation="vertical"
  aria-valuemin={minimum}
  aria-valuemax={maximum}
  aria-valuenow={Math.round(value)}
  aria-valuetext="{Math.round(value)}% old, {Math.round(100 - value)}% new"
  title="Drag to resize · Arrow keys to adjust · Double-click or Enter to reset"
  onpointerdown={startDrag}
  onpointermove={moveDivider}
  onpointerup={endDrag}
  onpointercancel={endDrag}
  onlostpointercapture={endDrag}
  onkeydown={resizeWithKeyboard}
  ondblclick={resetWidth}
>
  <span><GripVertical size={12} /></span>
</div>
