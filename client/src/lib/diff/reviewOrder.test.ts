import { describe, expect, it } from "vitest";
import type { DiffFile, ReviewScorecard } from "$types";
import { reviewOrder } from "./reviewOrder";

const file = (path: string) => ({ path }) as DiffFile;
const card = (paths: string[]) => ({ files: paths.map((path) => ({ path })) }) as ReviewScorecard;
const paths = (files: DiffFile[]) => files.map((f) => f.path);

describe("reviewOrder", () => {
  const files = [file("b/z.ts"), file("a.ts"), file("b/y.ts")];

  it("falls back to tree order without a scorecard", () => {
    expect(paths(reviewOrder(files, null))).toEqual(["b/z.ts", "b/y.ts", "a.ts"]);
  });
  it("follows the scorecard order", () => {
    expect(paths(reviewOrder(files, card(["a.ts", "b/z.ts", "b/y.ts"])))).toEqual(["a.ts", "b/z.ts", "b/y.ts"]);
  });
  it("appends unknown files in tree order and ignores stale scorecard paths", () => {
    expect(paths(reviewOrder(files, card(["gone.ts", "a.ts"])))).toEqual(["a.ts", "b/z.ts", "b/y.ts"]);
  });
});
