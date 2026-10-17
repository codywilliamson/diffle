import { describe, expect, it } from "vitest";
import { BINDINGS, CHORD_TIMEOUT_MS, MAX_COUNT, helpGroups } from "./keymap";
import { EMPTY_STATE, splitKeys, step } from "./parser";
import type { KeyInput, Mode, Outcome, ParserState } from "./types";

const key = (k: string, extra: Partial<KeyInput> = {}): KeyInput => ({
  key: k, ctrl: false, shift: false, alt: false, altGraph: false, meta: false, editable: false, ...extra,
});

// feed keys one after another, 10ms apart unless a time is given.
function run(keys: (string | [string, Partial<KeyInput>])[], mode: Mode = "normal", start = 0): { outcomes: Outcome[]; state: ParserState } {
  let state: ParserState = EMPTY_STATE;
  const outcomes: Outcome[] = [];
  keys.forEach((k, i) => {
    const [name, extra] = typeof k === "string" ? [k, {}] : k;
    const result = step(state, key(name, extra), mode, start + i * 10);
    state = result.state;
    outcomes.push(result.outcome);
  });
  return { outcomes, state };
}

const last = (o: Outcome[]): Outcome => o[o.length - 1]!;
const dispatched = (o: Outcome): { action: string; count: number | null } | null =>
  o.kind === "dispatch" ? { action: o.binding.action, count: o.count } : null;

describe("counts", () => {
  it("applies a count to the next counted motion", () => {
    expect(dispatched(last(run(["1", "0", "j"]).outcomes))).toEqual({ action: "line.next", count: 10 });
  });

  it("reports no count when none was typed", () => {
    expect(dispatched(last(run(["j"]).outcomes))).toEqual({ action: "line.next", count: null });
  });

  it("treats a lone 0 as nothing and keeps 0 as a later digit", () => {
    expect(last(run(["0"]).outcomes).kind).toBe("ignored");
    expect(dispatched(last(run(["2", "0", "J"]).outcomes))).toEqual({ action: "file.next", count: 20 });
  });

  it("caps the count", () => {
    const { outcomes } = run(["9", "9", "9", "9", "9", "9", "j"]);
    expect(dispatched(last(outcomes))?.count).toBe(MAX_COUNT);
  });

  it("ignores a count on a key that takes none, but still runs it", () => {
    expect(dispatched(last(run(["5", "t"]).outcomes))).toEqual({ action: "view.theme", count: null });
  });

  it("clears the count after a dispatch", () => {
    expect(dispatched(last(run(["3", "j", "j"]).outcomes))?.count).toBeNull();
  });

  it("drops a count followed by an unbound key", () => {
    const { outcomes, state } = run(["3", "z", "j"]);
    expect(outcomes[1]!.kind).toBe("dropped");
    expect(dispatched(last(outcomes))?.count).toBeNull();
    expect(state).toEqual(EMPTY_STATE);
  });

  it("uses the count as the line for G and leaves bare G as bottom", () => {
    expect(dispatched(last(run(["4", "2", "G"]).outcomes))).toEqual({ action: "goto.bottom", count: 42 });
    expect(dispatched(last(run(["G"]).outcomes))).toEqual({ action: "goto.bottom", count: null });
  });
});

describe("chords", () => {
  it("completes a g chord", () => {
    expect(run(["g"]).outcomes[0]!.kind).toBe("pending");
    expect(dispatched(last(run(["g", "g"]).outcomes))?.action).toBe("goto.top");
    expect(dispatched(last(run(["g", "c"]).outcomes))?.action).toBe("review.scorecard");
    expect(dispatched(last(run(["g", "w"]).outcomes))?.action).toBe("help.whatsNew");
  });

  it("carries a count through the prefix", () => {
    const { outcomes } = run(["3", "g", "g"]);
    expect(dispatched(last(outcomes))).toEqual({ action: "goto.top", count: null });
  });

  it("recognises reserved chords so they never fall through", () => {
    for (const second of ["d", "y", "h", "r", "s", "S", "/"]) {
      const outcome = last(run(["g", second]).outcomes);
      expect(outcome.kind, `g${second}`).toBe("dispatch");
      expect(outcome.kind === "dispatch" && outcome.binding.reserved, `g${second}`).toBe(true);
    }
  });

  it("drops an unknown second key without running it on its own", () => {
    const { outcomes, state } = run(["g", "j"]);
    expect(last(outcomes).kind).toBe("dropped");
    expect(state).toEqual(EMPTY_STATE);
    // the j was swallowed, so a fresh j is a normal j
    expect(dispatched(last(run(["g", "j", "j"]).outcomes))?.action).toBe("line.next");
  });

  it("drops the chord after the timeout and treats the next key fresh", () => {
    let result = step(EMPTY_STATE, key("g"), "normal", 0);
    result = step(result.state, key("g"), "normal", CHORD_TIMEOUT_MS + 1);
    // a timed-out g starts a new chord rather than completing the old one
    expect(result.outcome.kind).toBe("pending");
    expect(result.state.prefix).toBe("g");
  });

  it("still completes the chord right at the timeout", () => {
    let result = step(EMPTY_STATE, key("g"), "normal", 0);
    result = step(result.state, key("g"), "normal", CHORD_TIMEOUT_MS);
    expect(dispatched(result.outcome)?.action).toBe("goto.top");
  });

  it("keeps a pending count however long it waits", () => {
    let result = step(EMPTY_STATE, key("5"), "normal", 0);
    result = step(result.state, key("j"), "normal", CHORD_TIMEOUT_MS * 60);
    expect(dispatched(result.outcome)).toEqual({ action: "line.next", count: 5 });
  });

  it("times out only the g of a counted chord and keeps the count", () => {
    let result = step(EMPTY_STATE, key("3"), "normal", 0);
    result = step(result.state, key("g"), "normal", 10);
    result = step(result.state, key("j"), "normal", 10 + CHORD_TIMEOUT_MS + 1);
    expect(dispatched(result.outcome)).toEqual({ action: "line.next", count: 3 });
  });

  it("splits binding keys into tokens", () => {
    expect(splitKeys("gg")).toEqual(["g", "g"]);
    expect(splitKeys("Ctrl+d")).toEqual(["Ctrl+d"]);
    expect(splitKeys("Esc")).toEqual(["Esc"]);
  });
});

describe("escape", () => {
  it("cancels a pending count, then a pending chord, then falls through", () => {
    expect(last(run(["4", "Escape"]).outcomes).kind).toBe("cancelled");
    expect(last(run(["g", "Escape"]).outcomes).kind).toBe("cancelled");
    expect(last(run(["Escape"]).outcomes).kind).toBe("escape");
    // after cancelling the count is gone
    expect(dispatched(last(run(["4", "Escape", "j"]).outcomes))?.count).toBeNull();
  });

  it("needs one Esc per layer", () => {
    const { outcomes } = run(["3", "g", "Escape", "Escape"]);
    expect(outcomes.map((o) => o.kind)).toEqual(["pending", "pending", "cancelled", "escape"]);
  });
});

describe("modifiers and editable fields", () => {
  it("binds only the ctrl motions", () => {
    expect(dispatched(last(run([["d", { ctrl: true }]]).outcomes))?.action).toBe("page.down");
    expect(dispatched(last(run([["u", { ctrl: true }]]).outcomes))?.action).toBe("page.up");
    expect(dispatched(last(run([["o", { ctrl: true }]]).outcomes))?.action).toBe("jump.back");
    expect(dispatched(last(run([["i", { ctrl: true }]]).outcomes))?.action).toBe("jump.forward");
    expect(last(run([["r", { ctrl: true }]]).outcomes).kind).toBe("ignored");
    expect(last(run([["j", { ctrl: true }]]).outcomes).kind).toBe("ignored");
    expect(last(run([["j", { meta: true }]]).outcomes).kind).toBe("ignored");
    expect(last(run([["j", { alt: true }]]).outcomes).kind).toBe("ignored");
    expect(last(run([["D", { ctrl: true, shift: true }]]).outcomes).kind).toBe("ignored");
  });

  it("treats AltGr symbols as the plain key", () => {
    const altGr = { ctrl: true, alt: true, altGraph: true };
    expect(dispatched(last(run([["]", altGr]]).outcomes))?.action).toBe("hunk.next");
    expect(dispatched(last(run([["[", altGr]]).outcomes))?.action).toBe("hunk.prev");
    // a real ctrl+alt chord without AltGraph, or an AltGr letter, stays ignored
    expect(last(run([["]", { ctrl: true, alt: true }]]).outcomes).kind).toBe("ignored");
    expect(last(run([["j", altGr]]).outcomes).kind).toBe("ignored");
  });

  it("ignores every key in an editable field except Esc", () => {
    expect(last(run([["j", { editable: true }]]).outcomes).kind).toBe("ignored");
    expect(last(run([["1", { editable: true }]]).outcomes).kind).toBe("ignored");
    expect(last(run([["g", { editable: true }]]).outcomes).kind).toBe("ignored");
    expect(last(run([["Escape", { editable: true }]]).outcomes).kind).toBe("escape");
  });

  it("does not let typing in a field disturb a pending count", () => {
    const { outcomes } = run(["3", ["x", { editable: true }], "j"]);
    expect(dispatched(last(outcomes))?.count).toBe(3);
  });
});

describe("modes", () => {
  it("only matches bindings for the active mode, or any", () => {
    expect(last(run(["j"], "visual").outcomes).kind).toBe("ignored");
    expect(dispatched(last(run(["?"], "visual").outcomes))?.action).toBe("help.keys");
  });
});

describe("the table", () => {
  it("has no duplicate keys within a mode", () => {
    const seen = new Set<string>();
    for (const b of BINDINGS) {
      const id = `${b.mode}:${b.keys}`;
      expect(seen.has(id), id).toBe(false);
      seen.add(id);
    }
  });

  it("never binds a single key that is also a chord prefix", () => {
    const prefixes = new Set(BINDINGS.map((b) => splitKeys(b.keys)).filter((t) => t.length > 1).map((t) => t[0]));
    for (const b of BINDINGS) expect(prefixes.has(b.keys) && splitKeys(b.keys).length === 1, b.keys).toBe(false);
  });

  it("keeps c reserved, not bound to the feedback preview", () => {
    const c = BINDINGS.find((b) => b.keys === "c");
    expect(c?.reserved).toBe(true);
    expect(BINDINGS.find((b) => b.action === "review.preview")?.keys).toBe("P");
  });

  it("binds search keys for real, with n taken from what's new", () => {
    for (const [keys, action] of [["/", "search.file"], ["n", "search.next"], ["N", "search.prev"]] as const) {
      const bindings = BINDINGS.filter((b) => b.keys === keys);
      expect(bindings.map((b) => [b.action, b.reserved])).toEqual([[action, undefined]]);
    }
    expect(BINDINGS.find((b) => b.action === "help.whatsNew")?.keys).toBe("gw");
  });

  it("hides reserved bindings from help and shows counts only where allowed", () => {
    const shown = helpGroups().flatMap((g) => g.bindings);
    expect(shown.some((b) => b.reserved)).toBe(false);
    expect(shown.find((b) => b.keys === "j")?.count).toBe(true);
    expect(shown.find((b) => b.keys === "t")?.count).toBe(false);
    expect(helpGroups().map((g) => g.group)).toEqual(["Move", "Search", "View", "Review", "Help"]);
  });
});
