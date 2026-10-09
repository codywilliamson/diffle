import { describe, expect, it } from "vitest";
import type { FileAnalysis } from "$types";
import { fileChips, worstBand } from "./fileChips";

const base: FileAnalysis = {
  path: "a.cs", language: "csharp", group: "g", noise: null, whitespaceOnlyHunks: [], noiseLines: 0,
  effectiveLines: 1, testPair: null, isTest: false, churn: 0, changedSinceReview: null, flags: [],
};

describe("fileChips", () => {
  it("has no chips for a quiet file", () => {
    expect(fileChips(base)).toEqual({ chips: [], details: [] });
  });

  it("summarises flags by worst band and keeps hotspot on its own chip", () => {
    const result = fileChips({
      ...base,
      churn: 14,
      flags: [
        { kind: "leftover", reason: "TODO left in", line: 7 },
        { kind: "public-api-removed", reason: "public method removed" },
        { kind: "hotspot", reason: "changed 14 times" },
      ],
    });
    expect(result.chips).toEqual([
      { id: "flags", text: "2 flags", band: "high" },
      { id: "hot", text: "hot · 14 commits", band: null },
    ]);
    expect(result.details).toEqual(["TODO left in (line 7)", "public method removed", "changed 14 times"]);
  });

  it("uses singular wording and adds a test chip", () => {
    const result = fileChips({ ...base, isTest: true, flags: [{ kind: "untested", reason: "x" }] });
    expect(result.chips.map((c) => c.text)).toEqual(["1 flag", "test"]);
    expect(worstBand([{ kind: "untested", reason: "x" }])).toBe("medium");
  });
});
