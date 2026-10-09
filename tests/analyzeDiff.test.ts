import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { rmSync } from "node:fs";
import type { ReviewScorecard } from "../src/types";
import { analyzeDiff, churnBaseFor } from "../src/core/analysis/analyzeDiff";
import { loadReviewTarget } from "../src/core/reviewTarget";
import { makeCsharpRepo } from "./fixtures/analysis/csharpRepo";

const SETUP_TIMEOUT_MS = 30_000; // many git spawns on windows
let repo: string;
let card: ReviewScorecard;
const fileOf = (path: string) => card.files.find((f) => f.path === path)!;
const category = (id: string) => card.categories.find((c) => c.id === id)!;

beforeAll(() => {
  repo = makeCsharpRepo();
  const loaded = loadReviewTarget(repo);
  card = analyzeDiff(loaded.diff, { cwd: repo, newRef: loaded.newRef, churnBase: churnBaseFor(loaded.meta) });
}, SETUP_TIMEOUT_MS);
afterAll(() => rmSync(repo, { recursive: true, force: true }));

describe("analyzeDiff on a c# solution", () => {
  it("orders referenced projects first and noise last", () => {
    expect(card.groups.map((g) => g.label)).toEqual(["Core", "Api", "Api.Tests", "Generated & lockfiles"]);
    expect(card.groups.at(-1)!.files).toEqual(["Api/packages.lock.json"]);
    expect(card.files.map((f) => f.path)).toEqual(card.groups.flatMap((g) => g.files));
    expect(card.files).toHaveLength(card.totals.files);
  });

  it("pairs the controller with its test and marks the lockfile as noise", () => {
    expect(fileOf("Api/UserController.cs").testPair).toBe("Api.Tests/UserControllerTests.cs");
    expect(fileOf("Api.Tests/UserControllerTests.cs").isTest).toBe(true);
    expect(fileOf("Api/packages.lock.json")).toMatchObject({ noise: "lockfile", effectiveLines: 0, flags: [] });
  });

  it("counts a reindented hunk that is also a moved block once", () => {
    const controller = fileOf("Api/UserController.cs");
    expect(controller.whitespaceOnlyHunks).toEqual([0]);
    expect(controller.noiseLines).toBe(8);
    expect(controller.effectiveLines).toBe(0);
  });

  it("detects the moved method and discounts it", () => {
    expect(card.moved.some((m) => m.from.file === "Core/User.cs" && m.to.file === "Core/Util.cs")).toBe(true);
    expect(fileOf("Core/Util.cs").noiseLines).toBeGreaterThan(0);
  });

  it("flags the removed method, the todo, the package bump, and untested code", () => {
    const user = fileOf("Core/User.cs");
    expect(user.flags.map((f) => f.kind)).toEqual(expect.arrayContaining(["public-api-removed", "leftover", "untested"]));
    const csproj = fileOf("Core/Core.csproj");
    expect(csproj.flags.map((f) => f.kind)).toEqual(expect.arrayContaining(["dependency", "sensitive-path"]));
    expect(fileOf("Api/UserController.cs").flags.map((f) => f.kind)).not.toContain("untested");
  });

  it("scores the categories", () => {
    expect(category("api").band).toBe("high");
    expect(category("dependencies").band).toBe("medium");
    expect(category("tests").band).toBe("medium");
    expect(category("size").band).toBe("low");
    expect(category("hotspots").band).toBe("low");
    expect(category("flags").band).toBe("high"); // sensitive csproj + removed public api
    expect(category("api").reasons[0]).toContain("Core/User.cs");
  });

  it("keeps totals consistent", () => {
    const { additions, deletions, effectiveLines, noiseLines } = card.totals;
    expect(effectiveLines + noiseLines).toBe(additions + deletions);
    expect(card.files.every((f) => f.changedSinceReview === null)).toBe(true);
  });
});

describe("churnBaseFor", () => {
  it("uses the base ref in branch mode and the from-ref in range mode", () => {
    const meta = (mode: string) => ({ repo: "r", mode, source: "feat", target: "main" });
    expect(churnBaseFor(meta("branch"))).toBe("main");
    expect(churnBaseFor(meta("range"))).toBe("feat");
    expect(churnBaseFor(meta("working tree"))).toBeNull();
    expect(churnBaseFor(undefined)).toBeNull();
  });
});
