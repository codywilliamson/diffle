import { describe, expect, it } from "vitest";
import type { MovedBlock } from "$types";
import { movedLookup } from "./movedLines";

const block: MovedBlock = {
  from: { file: "src/Foo.cs", start: 12, end: 14 },
  to: { file: "src/Bar.cs", start: 40, end: 42 },
  edited: false,
};

describe("movedLookup", () => {
  it("marks the destination file's new-side lines and labels the first", () => {
    const lookup = movedLookup([block], "src/Bar.cs");
    expect(lookup.mark("new", 40)).toEqual({ label: "moved from Foo.cs:12", file: "src/Foo.cs", first: true });
    expect(lookup.mark("new", 41)?.first).toBe(false);
    expect(lookup.mark("new", 43)).toBeNull();
    expect(lookup.mark("old", 40)).toBeNull();
  });

  it("marks the source file's old-side lines and notes edits", () => {
    const lookup = movedLookup([{ ...block, edited: true }], "src/Foo.cs");
    expect(lookup.mark("old", 12)?.label).toBe("moved to Bar.cs:40 (edited)");
    expect(lookup.mark("old", 14)?.first).toBe(false);
    expect(lookup.mark("new", 12)).toBeNull();
  });

  it("handles a move within one file and unrelated files", () => {
    const same: MovedBlock = { from: { file: "a.cs", start: 1, end: 1 }, to: { file: "a.cs", start: 9, end: 9 }, edited: false };
    const lookup = movedLookup([same], "a.cs");
    expect(lookup.mark("old", 1)?.label).toBe("moved to a.cs:9");
    expect(lookup.mark("new", 9)?.label).toBe("moved from a.cs:1");
    expect(movedLookup([same], "b.cs").mark("new", 9)).toBeNull();
  });
});
