// pure radar model logic: lane ordering, map building, mark stepping, counts, and status
// derivation. the visual components are verified in a browser, not here.
import { test, expect } from "bun:test";
import {
  laneRank, buildMap, markOrder, stepMark, laneCounts,
  prioritizedUnits, unitState, topUnitForFile, unitCountForFile,
} from "../src/client/radar/model.js";

const u = (id: string, file: string, lane: string, line: number, extra = {}) => ({ id, file, lane, line, ...extra });

// three files out of diff order, mixed lanes, so ordering is observable.
const FILES = ["a.ts", "b.ts", "c.ts"];
const UNITS = [
  u("n1", "c.ts", "noise", 5),
  u("v1", "b.ts", "verified", 9),
  u("a1", "b.ts", "attention", 2),
  u("r1", "a.ts", "routine", 4),
];

test("laneRank orders verified above routine above noise", () => {
  expect(laneRank("blocker")).toBeLessThan(laneRank("verified"));
  expect(laneRank("verified")).toBeLessThan(laneRank("routine"));
  expect(laneRank("routine")).toBeLessThan(laneRank("noise"));
  expect(laneRank("unknown")).toBe(6);
});

test("buildMap orders segments by strongest lane then diff position", () => {
  const segs = buildMap(UNITS, FILES);
  // b.ts (verified) leads, then a.ts (routine), then c.ts (noise).
  expect(segs.map((s) => s.path)).toEqual(["b.ts", "a.ts", "c.ts"]);
  // within b.ts, verified sorts before attention.
  expect(segs[0]!.units.map((x) => x.id)).toEqual(["v1", "a1"]);
});

test("markOrder + stepMark walk the map order and clamp at the ends", () => {
  const order = markOrder(buildMap(UNITS, FILES));
  expect(order).toEqual(["v1", "a1", "r1", "n1"]);
  expect(stepMark(order, "v1", 1)).toBe("a1");
  expect(stepMark(order, "v1", -1)).toBe("v1"); // clamped at the start
  expect(stepMark(order, "n1", 1)).toBe("n1"); // clamped at the end
  expect(stepMark([], "x", 1)).toBeNull();
});

test("laneCounts tallies per lane plus a total", () => {
  const c = laneCounts(UNITS) as Record<string, number>;
  expect(c.total).toBe(4);
  expect(c.verified).toBe(1);
  expect(c.attention).toBe(1);
  expect(c.boundary).toBe(0);
});

test("prioritizedUnits blanks empty diffs but keeps deterministic no-attention lanes", () => {
  expect(prioritizedUnits(UNITS, "ready")).toHaveLength(4);
  expect(prioritizedUnits(UNITS, "empty")).toHaveLength(0);
  expect(prioritizedUnits(UNITS, "noattention")).toHaveLength(3);
  expect(prioritizedUnits(UNITS, "noattention").some((x: { lane: string }) => x.lane === "attention")).toBe(false);
});

test("unitState keeps deterministic lanes and only degrades remote enrichment", () => {
  const remote = u("x", "a.ts", "attention", 1, { remote: true });
  const blocker = u("b", "a.ts", "blocker", 1);
  const staleUnit = u("s", "a.ts", "attention", 1, { remote: true, stale: true });
  expect(unitState(remote, "analyzing")).toBe("analyzing");
  expect(unitState(remote, "failure")).toBe("failed");
  expect(unitState(remote, "ready")).toBe("ready");
  expect(unitState(blocker, "ready")).toBe("blocked"); // blockers never transmit
  expect(unitState(staleUnit, "stale")).toBe("stale");
  expect(unitState(remote, "cached")).toBe("cached");
});

test("topUnitForFile picks the strongest lane and counts per file", () => {
  expect(topUnitForFile(UNITS, "b.ts").id).toBe("v1");
  expect(unitCountForFile(UNITS, "b.ts")).toBe(2);
  expect(unitCountForFile(UNITS, "missing.ts")).toBe(0);
});
