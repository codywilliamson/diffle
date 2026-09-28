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
