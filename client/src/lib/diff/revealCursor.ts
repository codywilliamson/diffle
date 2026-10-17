// keep the keyboard cursor on screen. scrolls only when the row leaves a margin band, always
// instantly (a smooth scroll per keystroke lags behind held keys and fights the sidebar's
// smooth scroll, the #128 regression), and waits for lazily mounted rows to exist.

export const REVEAL_MARGIN_PX = 72;
export const REVEAL_MAX_FRAMES = 20;

interface Span {
  top: number;
  bottom: number;
}

// how far to scroll so the row sits inside the band; 0 while it is already comfortably visible.
export function scrollDelta(row: Span, pane: Span, headerHeight: number, margin = REVEAL_MARGIN_PX): number {
  const gap = Math.min(margin, (pane.bottom - pane.top) / 4);
  const bandTop = pane.top + headerHeight + gap;
  const bandBottom = pane.bottom - gap;
  if (row.bottom < pane.top || row.top > pane.bottom) return (row.top + row.bottom) / 2 - (bandTop + bandBottom) / 2;
  if (row.top < bandTop) return row.top - bandTop;
  if (row.bottom > bandBottom) return row.bottom - bandBottom;
  return 0;
}

export type RevealTarget = { kind: "line" | "file"; path: string };

function sectionFor(pane: Element, path: string): HTMLElement | undefined {
  return [...pane.querySelectorAll<HTMLElement>("[data-file-path]")].find((el) => el.dataset.filePath === path);
}

function attempt(target: RevealTarget): boolean {
  const pane = document.querySelector<HTMLElement>("[data-diff-pane]");
  if (!pane) return true;
  const section = sectionFor(pane, target.path);
  if (!section) return false;
  const paneRect = pane.getBoundingClientRect();
  if (target.kind === "file") {
    pane.scrollTo({ top: pane.scrollTop + section.getBoundingClientRect().top - paneRect.top, behavior: "instant" });
    return true;
  }
  const row = section.querySelector<HTMLElement>("[data-cursor]");
  if (!row) return false;
  const header = section.querySelector<HTMLElement>("[data-file-header]");
  const delta = scrollDelta(row.getBoundingClientRect(), paneRect, header?.offsetHeight ?? 0);
  if (delta !== 0) pane.scrollTo({ top: pane.scrollTop + delta, behavior: "instant" });
  return true;
}

// retry across frames: the file may still be switching in or mounting its rows. returns a cancel.
export function revealCursor(target: RevealTarget): () => void {
  let frame = 0;
  let id = 0;
  const tick = (): void => {
    if (attempt(target) || ++frame >= REVEAL_MAX_FRAMES) return;
    id = requestAnimationFrame(tick);
  };
  id = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(id);
}
