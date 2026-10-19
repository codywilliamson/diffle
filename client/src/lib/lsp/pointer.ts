// the mouse side of code navigation, as one svelte action on the diff pane: Ctrl/Cmd+click goes
// to the definition of the word under the pointer, and a pointer resting on a word shows its
// hover docs. positions come from the rendered text (domPosition.ts), so word-diff marks,
// syntax spans and wrapped lines all map to the same utf-16 offsets.

import type { LspStore } from "./lsp.svelte";
import { hitAtPoint } from "./domPosition";

const LINK_CLASS = "lsp-link-mode"; // Ctrl/Cmd held: words are clickable

export function lspPointer(node: HTMLElement, lsp: LspStore): { destroy: () => void } {
  let frame = 0;
  let last: { x: number; y: number } | null = null;

  function sample(): void {
    frame = 0;
    if (!last) return;
    const hit = hitAtPoint(last.x, last.y);
    if (hit) lsp.point(hit); // remember the last word rested on, for gd and gh
    // the server said the removed side is off: say why on hover
    if (hit?.side === "old" && lsp.removedSideHint) hit.root.title = lsp.removedSideHint;
    lsp.hover.pointerOver(hit);
  }

  function onMove(event: PointerEvent): void {
    if (event.pointerType === "touch") return;
    last = { x: event.clientX, y: event.clientY };
    node.classList.toggle(LINK_CLASS, event.ctrlKey || event.metaKey);
    if (!frame) frame = requestAnimationFrame(sample);
  }

  function onLeave(): void {
    last = null;
    lsp.hover.pointerOver(null);
  }

  function onClick(event: MouseEvent): void {
    if (event.button !== 0 || !(event.ctrlKey || event.metaKey)) return;
    const hit = hitAtPoint(event.clientX, event.clientY);
    if (!hit) return;
    event.preventDefault();
    event.stopPropagation();
    lsp.definitionAtHit(hit);
  }

  function onModifier(event: KeyboardEvent): void {
    if (event.key === "Control" || event.key === "Meta") node.classList.toggle(LINK_CLASS, event.type === "keydown");
  }

  const hideCard = (): void => void lsp.hover.close();

  node.addEventListener("pointermove", onMove);
  node.addEventListener("pointerleave", onLeave);
  node.addEventListener("click", onClick, true);
  node.addEventListener("scroll", hideCard, true);
  node.addEventListener("wheel", hideCard, { passive: true });
  window.addEventListener("keydown", onModifier);
  window.addEventListener("keyup", onModifier);
  window.addEventListener("blur", hideCard);

  return {
    destroy() {
      cancelAnimationFrame(frame);
      node.removeEventListener("pointermove", onMove);
      node.removeEventListener("pointerleave", onLeave);
      node.removeEventListener("click", onClick, true);
      node.removeEventListener("scroll", hideCard, true);
      node.removeEventListener("wheel", hideCard);
      window.removeEventListener("keydown", onModifier);
      window.removeEventListener("keyup", onModifier);
      window.removeEventListener("blur", hideCard);
    },
  };
}
