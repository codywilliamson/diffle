import { describe, expect, it } from "vitest";
import { REVEAL_X_MARGIN_PX, scrollDeltaX } from "./revealMatchX";

const box = { left: 100, right: 1100 };

describe("scrollDeltaX", () => {
  it("stays put while the match is comfortably inside", () => {
    expect(scrollDeltaX({ left: 400, right: 480 }, box)).toBe(0);
  });

  it("scrolls right to a match past the right edge", () => {
    const delta = scrollDeltaX({ left: 23744, right: 23824 }, box);
    expect(23824 - delta).toBe(box.right - REVEAL_X_MARGIN_PX);
  });

  it("scrolls left to a match before the left edge", () => {
    const delta = scrollDeltaX({ left: -500, right: -420 }, box);
    expect(-500 - delta).toBe(box.left + REVEAL_X_MARGIN_PX);
  });

  it("keeps a leftward reveal clear of a sticky gutter", () => {
    const gutter = 66;
    const delta = scrollDeltaX({ left: 160, right: 240 }, box, gutter);
    expect(160 - delta).toBe(box.left + gutter + REVEAL_X_MARGIN_PX);
    expect(scrollDeltaX({ left: 160, right: 240 }, box)).toBe(0);
  });

  it("shrinks the margin in a narrow box", () => {
    expect(scrollDeltaX({ left: 10, right: 30 }, { left: 0, right: 40 })).toBe(0);
  });
});
