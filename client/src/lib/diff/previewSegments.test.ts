import { describe, expect, it } from "vitest";
import { previewSegments } from "./previewSegments";

describe("previewSegments", () => {
  it("splits around ranges and keeps html as text", () => {
    expect(previewSegments("a <b> c", [[2, 5]])).toEqual([
      { text: "a ", match: false },
      { text: "<b>", match: true },
      { text: " c", match: false },
    ]);
  });
  it("returns the whole line when there are no ranges", () => {
    expect(previewSegments("abc", [])).toEqual([{ text: "abc", match: false }]);
  });
  it("clamps, drops empty and merges overlapping ranges", () => {
    expect(previewSegments("abcdef", [[4, 99], [1, 3], [2, 4], [3, 3]])).toEqual([
      { text: "a", match: false },
      { text: "bcdef", match: true },
    ]);
  });
});
