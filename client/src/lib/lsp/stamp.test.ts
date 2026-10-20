import { describe, expect, it } from "vitest";
import { createUiStore } from "$lib/state/ui.svelte";
import { navigationStamp, sameStamp } from "./stamp";

describe("navigationStamp", () => {
  it("changes on a cursor move, a sidebar file pick and a repeated pick of the same file", () => {
    const ui = createUiStore();
    const cursor = { revealSeq: 0 };
    const at = () => navigationStamp(cursor, ui);
    const start = at();
    expect(sameStamp(start, at())).toBe(true);

    cursor.revealSeq++; // j, J, ], search step, search-hit jump
    expect(sameStamp(start, at())).toBe(false);

    const afterMove = at();
    ui.selectFile("a.ts");
    expect(sameStamp(afterMove, at())).toBe(false);

    const afterPick = at();
    ui.selectFile("a.ts");
    expect(sameStamp(afterPick, at())).toBe(false);
  });

  it("sameStamp compares by value, length included", () => {
    expect(sameStamp([1, "a"], [1, "a"])).toBe(true);
    expect(sameStamp([1], [1, 2])).toBe(false);
  });
});
