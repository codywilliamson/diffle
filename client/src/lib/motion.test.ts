import { afterEach, describe, expect, it, vi } from "vitest";
import { revealRows } from "./motion";

function mockReducedMotion(matches: boolean): void {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches, media: query }));
}

function tableWith(rows: number): { node: HTMLElement; animate: ReturnType<typeof vi.fn> } {
  const node = document.createElement("div");
  node.innerHTML = `<table><tbody>${'<tr class="diff-row"></tr>'.repeat(rows)}<tr class="hunk-header"></tr></tbody></table>`;
  const animate = vi.fn();
  for (const tr of node.querySelectorAll("tr")) (tr as HTMLElement).animate = animate;
  return { node, animate };
}

afterEach(() => vi.unstubAllGlobals());

describe("revealRows", () => {
  it.each([5, 60])("reveals matching rows together in both %i-row panes", (count) => {
    mockReducedMotion(false);
    const node = document.createElement("div");
    const rows = '<div class="diff-row"></div>'.repeat(count);
    node.innerHTML = `<section class="split-pane">${rows}</section><section class="split-pane">${rows}</section>`;
    const animate = vi.fn();
    for (const row of node.querySelectorAll<HTMLElement>(".diff-row")) row.animate = animate;

    revealRows(node);

    const revealedRows = Math.min(count, 40);
    expect(animate).toHaveBeenCalledTimes(revealedRows * 2);
    for (let index = 0; index < revealedRows; index++) {
      const oldOptions = animate.mock.calls[index]![1];
      const newOptions = animate.mock.calls[index + revealedRows]![1];
      expect(newOptions.delay).toBe(oldOptions.delay);
    }
  });

  it("staggers only the first diff rows", () => {
    mockReducedMotion(false);
    const { node, animate } = tableWith(60);
    revealRows(node);
    expect(animate).toHaveBeenCalledTimes(40);
    expect(animate.mock.calls[0]?.[1].delay).toBe(0);
    expect(animate.mock.calls[1]?.[1].delay).toBeGreaterThan(0);
  });

  it("does nothing under reduced motion", () => {
    mockReducedMotion(true);
    const { node, animate } = tableWith(5);
    revealRows(node);
    expect(animate).not.toHaveBeenCalled();
  });
});
