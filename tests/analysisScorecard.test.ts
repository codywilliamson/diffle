import { describe, expect, it } from "bun:test";
import type { FileAnalysis, ReviewScorecard } from "../src/types";
import { buildCategories, MAX_REASONS } from "../src/core/analysis/scorecardBands";
import { analysis, flag } from "./fixtures/analysis/fileAnalysis";

const totalsOf = (files: FileAnalysis[], noiseLines = 0): ReviewScorecard["totals"] => {
  const effectiveLines = files.reduce((n, f) => n + f.effectiveLines, 0);
  return { files: files.length, additions: effectiveLines + noiseLines, deletions: 0, effectiveLines, noiseLines };
};
const bandOf = (files: FileAnalysis[], id: string, noiseLines = 0) =>
  buildCategories(files, totalsOf(files, noiseLines)).find((c) => c.id === id)!;
const many = (n: number, over: (i: number) => Partial<FileAnalysis>) => Array.from({ length: n }, (_, i) => analysis(`f${i}.cs`, over(i)));

describe("size band", () => {
  it.each([[199, "low"], [200, "medium"], [599, "medium"], [600, "high"]])("%i lines is %s", (lines, band) => {
    expect(bandOf([analysis("a.cs", { effectiveLines: lines })], "size").band).toBe(band as never);
  });

  it("mentions files and hidden noise lines", () => {
    const files = [analysis("a.cs", { effectiveLines: 412 })];
    expect(bandOf(files, "size", 230).summary).toBe("412 effective lines across 1 file (230 noise lines hidden)");
  });
});

describe("tests band", () => {
  it.each([[0, "low"], [1, "medium"], [2, "medium"], [3, "high"]])("%i untested is %s", (n, band) => {
    const files = many(n, () => ({ flags: [flag("untested")] }));
    expect(bandOf(files, "tests").band).toBe(band as never);
  });
});

describe("api band", () => {
  it("is high on a removal, medium when only added, else low", () => {
    expect(bandOf([analysis("a.cs", { flags: [flag("public-api-removed"), flag("public-api-added")] })], "api").band).toBe("high");
    expect(bandOf([analysis("a.cs", { flags: [flag("public-api-added")] })], "api").band).toBe("medium");
    expect(bandOf([analysis("a.cs")], "api").band).toBe("low");
  });
});

describe("dependencies band", () => {
  const dep = (reason: string) => [analysis("a.csproj", { flags: [flag("dependency", reason)] })];
  it("is medium for added or bumped packages", () => {
    expect(bandOf(dep("added dependency Foo 1.0"), "dependencies").band).toBe("medium");
    expect(bandOf(dep("changed dependency Foo from 1.0 to 2.0"), "dependencies").band).toBe("medium");
  });
  it("is high for removals and runtime changes", () => {
    expect(bandOf(dep("removed dependency Foo 1.0"), "dependencies").band).toBe("high");
    expect(bandOf(dep("changed dependency TargetFramework from net8.0 to net10.0"), "dependencies").band).toBe("high");
    expect(bandOf(dep("changed dependency dotnet sdk from 8.0.100 to 10.0.100"), "dependencies").band).toBe("high");
  });
  it("is low with no dependency flags", () => {
    expect(bandOf([analysis("a.cs")], "dependencies").band).toBe("low");
  });
});

describe("hotspots band", () => {
  it.each([[0, "low"], [2, "medium"], [3, "high"]])("%i hotspots is %s", (n, band) => {
    expect(bandOf(many(n, () => ({ flags: [flag("hotspot")] })), "hotspots").band).toBe(band as never);
  });
});

describe("flags band", () => {
  it("is low with none, medium with a few, high at five", () => {
    expect(bandOf([analysis("a.cs")], "flags").band).toBe("low");
    expect(bandOf([analysis("a.cs", { flags: [flag("sensitive-path")] })], "flags").band).toBe("medium");
    expect(bandOf([analysis("a.cs", { flags: Array(4).fill(flag("leftover")) })], "flags").band).toBe("medium");
    expect(bandOf([analysis("a.cs", { flags: Array(5).fill(flag("leftover")) })], "flags").band).toBe("high");
  });

  it("is high when a sensitive path meets a removed public api", () => {
    const files = [analysis("Program.cs", { flags: [flag("sensitive-path")] }), analysis("b.cs", { flags: [flag("public-api-removed")] })];
    expect(bandOf(files, "flags").band).toBe("high");
  });
});

describe("reasons", () => {
  it("name files and cap at MAX_REASONS with a +N more", () => {
    const files = many(MAX_REASONS + 3, () => ({ flags: [flag("untested", "no test")] }));
    const reasons = bandOf(files, "tests").reasons;
    expect(reasons).toHaveLength(MAX_REASONS + 1);
    expect(reasons[0]).toBe("f0.cs: no test");
    expect(reasons.at(-1)).toBe("+3 more");
  });
});
