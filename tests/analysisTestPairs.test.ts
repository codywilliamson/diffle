import { describe, expect, it } from "bun:test";
import { pairTests } from "../src/core/analysis/testPairs";
import { file } from "./fixtures/analysis/diffBuilders";

const pair = (...paths: string[]) => pairTests(paths.map((p) => file(p, [])));

describe("pairTests with same-named files", () => {
  it("pairs a test only with the source sharing the longest directory prefix", () => {
    const pairs = pair("packages/a/src/user.ts", "packages/b/src/user.ts", "packages/b/tests/user.test.ts");
    expect(pairs.get("packages/b/tests/user.test.ts")).toBe("packages/b/src/user.ts");
    expect(pairs.get("packages/b/src/user.ts")).toBe("packages/b/tests/user.test.ts");
    expect(pairs.has("packages/a/src/user.ts")).toBe(false);
  });

  it("breaks ties alphabetically", () => {
    const pairs = pair("x/user.ts", "y/user.ts", "user.test.ts");
    expect(pairs.get("user.test.ts")).toBe("x/user.ts");
    expect(pairs.has("y/user.ts")).toBe(false);
  });

  it("gives a source its closest test and leaves the other test unpaired", () => {
    const pairs = pair("packages/a/src/user.ts", "packages/a/tests/user.test.ts", "packages/b/tests/user.test.ts");
    expect(pairs.get("packages/a/src/user.ts")).toBe("packages/a/tests/user.test.ts");
    expect(pairs.has("packages/b/tests/user.test.ts")).toBe(false);
  });
});
