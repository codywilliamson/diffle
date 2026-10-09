import { describe, expect, it } from "vitest";
import type { ChangeFlag } from "$types";
import { flagBand, worstBand, worstFlagBand } from "./bands";

const flag = (kind: ChangeFlag["kind"]): ChangeFlag => ({ kind, reason: "r" });

describe("bands", () => {
  it("picks the worst band", () => {
    expect(worstBand([])).toBe("low");
    expect(worstBand(["low", "high", "medium"])).toBe("high");
    expect(worstBand(["low", "medium"])).toBe("medium");
  });
  it("rates flags", () => {
    expect(flagBand(flag("sensitive-path"))).toBe("high");
    expect(flagBand(flag("public-api-removed"))).toBe("high");
    expect(flagBand(flag("leftover"))).toBe("medium");
    expect(worstFlagBand([])).toBeNull();
    expect(worstFlagBand([flag("large"), flag("sensitive-path")])).toBe("high");
  });
});
