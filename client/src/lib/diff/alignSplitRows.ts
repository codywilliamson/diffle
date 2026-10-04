import type { Action } from "svelte/action";

function setPaneScrollWidth(pane: HTMLElement): void {
  const codeLines = pane.querySelectorAll<HTMLElement>(".code-inner");
  let widestCode = 0;
  for (const line of codeLines) {
    widestCode = Math.max(widestCode, line.scrollWidth);
  }

  const codeCell = pane.querySelector<HTMLElement>(".code");
  const cellStyle = codeCell ? getComputedStyle(codeCell) : null;
  const codePadding = cellStyle
    ? parseFloat(cellStyle.paddingLeft) + parseFloat(cellStyle.paddingRight)
    : 0;
  const gutterWidth = pane.querySelector<HTMLElement>(".split-gutter")?.offsetWidth ?? 0;
  const scrollWidth = widestCode + gutterWidth + codePadding;

  // short rows must span the full scroll width so their sticky gutters cannot scroll away.
  pane.style.setProperty("--split-code-width", `${scrollWidth}px`);
}

function matchRowHeights(oldRows: HTMLElement[], newRows: HTMLElement[]): void {
  // clear assigned heights before measuring; reads and writes happen in separate batches.
  for (const row of [...oldRows, ...newRows]) {
    row.style.height = "";
  }

  const heights = oldRows.map((oldRow, index) => {
    const oldHeight = oldRow.getBoundingClientRect().height;
    const newHeight = newRows[index]!.getBoundingClientRect().height;
    return Math.ceil(Math.max(oldHeight, newHeight));
  });

  for (const [index, height] of heights.entries()) {
    oldRows[index]!.style.height = `${height}px`;
    newRows[index]!.style.height = `${height}px`;
  }
}

export const alignSplitRows: Action<HTMLElement> = (node) => {
  let pendingFrame = 0;
  let disposed = false;
  const observedContent = new Set<Element>();
  const paneWidths = new WeakMap<Element, number>();

  function scheduleAlignment(): void {
    if (pendingFrame || disposed) return;
    pendingFrame = requestAnimationFrame(align);
  }

  // observe natural content sizes, not assigned row heights, to avoid resize feedback loops.
  const resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const isPane = entry.target.classList.contains("split-pane");
      const widthChanged = paneWidths.get(entry.target) !== entry.contentRect.width;
      if (!isPane || widthChanged) {
        scheduleAlignment();
      }
      paneWidths.set(entry.target, entry.contentRect.width);
    }
  });

  function updateObservedContent(): void {
    const currentContent = new Set(
      node.querySelectorAll(".split-pane, .code-inner, .comment-box"),
    );
    for (const element of observedContent) {
      if (currentContent.has(element)) continue;
      resizeObserver.unobserve(element);
      observedContent.delete(element);
    }
    for (const element of currentContent) {
      if (observedContent.has(element)) continue;
      resizeObserver.observe(element);
      observedContent.add(element);
    }
  }

  function align(): void {
    pendingFrame = 0;
    const panes = Array.from(node.querySelectorAll<HTMLElement>(".split-pane"));
    const rows = panes.map((pane) => Array.from(pane.children) as HTMLElement[]);
    const [oldRows, newRows] = rows;
    if (rows.length !== 2 || !oldRows || !newRows || oldRows.length !== newRows.length) {
      return;
    }

    updateObservedContent();
    for (const pane of panes) {
      setPaneScrollWidth(pane);
    }
    matchRowHeights(oldRows, newRows);
  }

  const mutationObserver = new MutationObserver(scheduleAlignment);
  mutationObserver.observe(node, { subtree: true, childList: true, characterData: true });
  void document.fonts?.ready.then(scheduleAlignment);
  scheduleAlignment();

  return {
    destroy(): void {
      disposed = true;
      cancelAnimationFrame(pendingFrame);
      mutationObserver.disconnect();
      resizeObserver.disconnect();
    },
  };
};
