import type { Side } from "./threads";
import type { UiStore } from "$lib/state/ui.svelte";

// mousedown on a bubble or line number: drag to select a line range on one side, then open the
// editor on release. shift-click extends the open range instead. the range is scoped to `side`
// so a drag only spans lines commentable on that side.
export function startSelect(e: MouseEvent, ui: UiStore, file: string, side: Side, anchor: number): void {
  e.preventDefault();
  if (e.shiftKey) {
    ui.extendAdd(file, side, anchor);
    return;
  }
  let head = anchor;
  const section = (e.currentTarget as HTMLElement).closest(".file-section");
  const attr = side === "old" ? "oldline" : "newline";
  ui.selectMove(file, side, anchor, anchor);

  // rAF-throttle: coalesce mousemove bursts to one update per frame.
  let raf = 0;
  let lastXY: [number, number] | null = null;
  const move = (ev: MouseEvent): void => {
    lastXY = [ev.clientX, ev.clientY];
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      if (!lastXY) return;
      const row = (document.elementFromPoint(lastXY[0], lastXY[1]) as HTMLElement | null)?.closest("tr.diff-row") as HTMLElement | null;
      const n = row && section?.contains(row) ? row.dataset[attr] : "";
      if (n && Number(n) !== head) {
        head = Number(n);
        ui.selectMove(file, side, anchor, head);
      }
    });
  };
  const stop = (): void => {
    document.removeEventListener("mousemove", move);
    document.removeEventListener("mouseup", stop);
    document.body.classList.remove("selecting");
    cancelAnimationFrame(raf);
    ui.selectCommit(file, side, Math.min(anchor, head), Math.max(anchor, head));
  };
  document.addEventListener("mousemove", move);
  document.addEventListener("mouseup", stop);
  document.body.classList.add("selecting");
}
