import { describe, expect, it } from "vitest";
import { scrollDelta } from "./revealCursor";

const pane = { top: 0, bottom: 800 };
const row = (top: number) => ({ top, bottom: top + 19 });

describe("scrollDelta", () => {
  it("stays put while the row is inside the margin band", () => {
    expect(scrollDelta(row(300), pane, 40)).toBe(0);
    expect(scrollDelta(row(130), pane, 40)).toBe(0);
  });

  it("scrolls just enough once the row crosses the band", () => {
    expect(scrollDelta(row(100), pane, 40)).toBe(100 - (40 + 72));
    expect(scrollDelta(row(740), pane, 40)).toBe(759 - (800 - 72));
  });

  it("clears the sticky file header", () => {
    expect(scrollDelta(row(60), pane, 40)).toBeLessThan(0);
  });

  it("centres a row that is nowhere near the pane", () => {
    const d = scrollDelta(row(5000), pane, 40);
    expect(5000 + 9.5 - d).toBeCloseTo((40 + 72 + 728) / 2, 5);
    expect(scrollDelta(row(-3000), pane, 0)).toBeLessThan(0);
  });

  it("shrinks the margin in a short pane", () => {
    expect(scrollDelta(row(60), { top: 0, bottom: 200 }, 0)).toBe(0);
  });
});
