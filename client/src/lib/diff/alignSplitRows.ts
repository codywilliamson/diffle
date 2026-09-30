import type { Action } from "svelte/action";

// measure natural row heights in one batch, then give both sides the taller slot. observe
// content rather than assigned row heights so resizing cannot feed back into another resize.
export const alignSplitRows: Action<HTMLElement> = (node) => {
  let frame = 0;
  let disposed = false;
  const observed = new Set<Element>();
  const widths = new WeakMap<Element, number>();
  const schedule = (): void => {
    if (!frame && !disposed) frame = requestAnimationFrame(align);
  };
  const resize = new ResizeObserver((entries) => {
    for (const entry of entries) {
      if (!entry.target.classList.contains("split-pane") || widths.get(entry.target) !== entry.contentRect.width) schedule();
      widths.set(entry.target, entry.contentRect.width);
    }
  });
  function align(): void {
    frame = 0;
    const panes = Array.from(node.querySelectorAll<HTMLElement>(".split-pane"));
    const rows = panes.map((pane) => Array.from(pane.children) as HTMLElement[]);
    if (rows.length !== 2 || rows[0]!.length !== rows[1]!.length) return;
    const content = new Set(node.querySelectorAll(".split-pane, .code-inner, .comment-box"));
    for (const element of observed) if (!content.has(element)) { resize.unobserve(element); observed.delete(element); }
    for (const element of content) if (!observed.has(element)) { resize.observe(element); observed.add(element); }
    // every code row spans the side's full scroll width, so sticky gutters on short lines
    // cannot hit their containing row's right edge and disappear behind a long-line scroll.
    for (const pane of panes) {
      const codeWidth = Array.from(pane.querySelectorAll<HTMLElement>(".code-inner")).reduce((width, code) => Math.max(width, code.scrollWidth), 0);
      const cell = pane.querySelector<HTMLElement>(".code");
      const style = cell ? getComputedStyle(cell) : null;
      const inset = style ? parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) : 0;
      const gutter = pane.querySelector<HTMLElement>(".split-gutter")?.offsetWidth ?? 0;
      pane.style.setProperty("--split-code-width", `${codeWidth + gutter + inset}px`);
    }
    for (const side of rows) for (const row of side) row.style.height = "";
    const heights = rows[0]!.map((row, index) => Math.ceil(Math.max(row.getBoundingClientRect().height, rows[1]![index]!.getBoundingClientRect().height)));
    for (const side of rows) side.forEach((row, index) => (row.style.height = `${heights[index]}px`));
  }
  const mutation = new MutationObserver(schedule);
  mutation.observe(node, { subtree: true, childList: true, characterData: true });
  void document.fonts?.ready.then(schedule);
  schedule();
  return { destroy: () => { disposed = true; cancelAnimationFrame(frame); mutation.disconnect(); resize.disconnect(); } };
};
