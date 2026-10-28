import { describe, expect, test } from "bun:test";
import {
  carriesTransitionAssets,
  daysUntilCutoff,
  liveSmokeDecision,
  TRANSITION_ASSETS_UNTIL,
  TRANSITION_CUTOFF_DECISION,
  TRANSITION_CUTOFF_WARN_DAYS,
  transitionAssetName,
} from "../src/core/transitionAssets";

const cutoff = new Date(TRANSITION_ASSETS_UNTIL);
const justBefore = new Date(cutoff.getTime() - 1);
const longBefore = new Date("2026-10-28T12:00:00Z");
const dayAfter = new Date(cutoff.getTime() + 86_400_000);

describe("transitionAssetName", () => {
  test("swaps the product prefix for the legacy one", () => {
    expect(transitionAssetName("nittle-linux-x64")).toBe("diffle-linux-x64");
    expect(transitionAssetName("nittle-windows-arm64.exe")).toBe("diffle-windows-arm64.exe");
  });
});

describe("carriesTransitionAssets", () => {
  test("every release carries them before the cutoff, however many shipped", () => {
    for (const version of ["0.29.0", "0.32.0", "0.40.7", "1.0.0"]) {
      expect(carriesTransitionAssets(version, longBefore)).toBe(true);
    }
    expect(carriesTransitionAssets("0.33.0", justBefore)).toBe(true);
  });

  test("the cutoff instant and everything after do not", () => {
    expect(carriesTransitionAssets("0.33.0", cutoff)).toBe(false);
    expect(carriesTransitionAssets("0.33.0", dayAfter)).toBe(false);
  });

  test("pre-rename and unparseable versions stay on the safe side", () => {
    expect(carriesTransitionAssets("0.28.1", dayAfter)).toBe(true);
    expect(carriesTransitionAssets("nonsense", dayAfter)).toBe(true);
  });
});

describe("liveSmokeDecision", () => {
  test("assets present: run, in or out of the window", () => {
    expect(liveSmokeDecision(true, longBefore)).toBe("run");
    expect(liveSmokeDecision(true, dayAfter)).toBe("run");
  });

  test("assets missing inside the window is a failure", () => {
    expect(liveSmokeDecision(false, longBefore)).toBe("fail");
    expect(liveSmokeDecision(false, justBefore)).toBe("fail");
  });

  test("assets missing on or after the cutoff skips", () => {
    expect(liveSmokeDecision(false, cutoff)).toBe("skip");
    expect(liveSmokeDecision(false, dayAfter)).toBe("skip");
  });
});

describe("daysUntilCutoff", () => {
  test("counts whole days, negative after", () => {
    expect(daysUntilCutoff(new Date(cutoff.getTime() - 3 * 86_400_000))).toBe(3);
    expect(daysUntilCutoff(cutoff)).toBe(0);
    expect(daysUntilCutoff(dayAfter)).toBe(-1);
  });
});

// the guard: the cutoff must never pass silently. inside the warning window either move
// TRANSITION_ASSETS_UNTIL out or write the decision into TRANSITION_CUTOFF_DECISION.
describe("cutoff guard", () => {
  test("a cutoff within the warning window needs a recorded decision", () => {
    const days = daysUntilCutoff(new Date());
    if (days <= TRANSITION_CUTOFF_WARN_DAYS) {
      expect(TRANSITION_CUTOFF_DECISION, `transition cutoff ${TRANSITION_ASSETS_UNTIL} is ${days} day(s) away: extend it or record a decision`).not.toBeNull();
    }
  });
});
