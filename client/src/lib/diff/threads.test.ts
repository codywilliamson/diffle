import { describe, expect, it } from "vitest";
import { selectedRange } from "./threads";

describe("selectedRange", () => {
  it("preserves and normalizes a multi-line selection", () => {
    expect(selectedRange({ file: "a.ts", side: "new", line: 9, endLine: 4 }, "a.ts", "new"))
      .toEqual({ line: 4, endLine: 9 });
  });

  it("rejects a selection for another file or side", () => {
    const adding = { file: "a.ts", side: "old" as const, line: 2, endLine: 5 };
    expect(selectedRange(adding, "b.ts", "old")).toBeNull();
    expect(selectedRange(adding, "a.ts", "new")).toBeNull();
  });
});
