import { describe, expect, it } from "vitest";
import { JUMP_HISTORY_CAP } from "$lib/keymap/keymap";
import { EMPTY_HISTORY, jumpBack, jumpForward, recordJump } from "./jumpHistory";
import type { CursorPos } from "./cursorSteps";

const pos = (line: number): CursorPos => ({ path: "a.ts", side: "new", line });

describe("jump history", () => {
  it("walks back and forward through recorded jumps", () => {
    let h = recordJump(EMPTY_HISTORY, pos(1)); // jumped away from line 1 to 20
    h = recordJump(h, pos(20)); // then from 20 to 50
    const back1 = jumpBack(h, pos(50));
    expect(back1.target).toEqual(pos(20));
    const back2 = jumpBack(back1.history, pos(20));
    expect(back2.target).toEqual(pos(1));
    expect(jumpBack(back2.history, pos(1)).target).toBeNull();
    const fwd = jumpForward(back2.history, pos(1));
    expect(fwd.target).toEqual(pos(20));
    expect(jumpForward(fwd.history, pos(20)).target).toEqual(pos(50));
  });

  it("drops the forward entries on a new jump", () => {
    let h = recordJump(EMPTY_HISTORY, pos(1));
    h = jumpBack(h, pos(20)).history;
    expect(h.forward).toEqual([pos(20)]);
    h = recordJump(h, pos(1));
    expect(h.forward).toEqual([]);
  });

  it("does nothing when there is nowhere to go", () => {
    expect(jumpBack(EMPTY_HISTORY, pos(1))).toEqual({ history: EMPTY_HISTORY, target: null });
    expect(jumpForward(EMPTY_HISTORY, pos(1))).toEqual({ history: EMPTY_HISTORY, target: null });
  });

  it("skips a repeated entry and ignores a missing origin", () => {
    let h = recordJump(EMPTY_HISTORY, pos(1));
    h = recordJump(h, pos(1));
    h = recordJump(h, null);
    expect(h.back).toEqual([pos(1)]);
  });

  it("caps the history, dropping the oldest", () => {
    let h = EMPTY_HISTORY;
    for (let i = 1; i <= JUMP_HISTORY_CAP + 10; i++) h = recordJump(h, pos(i));
    expect(h.back).toHaveLength(JUMP_HISTORY_CAP);
    expect(h.back[0]).toEqual(pos(11));
  });
});
