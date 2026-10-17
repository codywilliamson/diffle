import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SessionEntry } from "../src/core/sessions";
import { listSessions, registerSession } from "../src/core/sessions";
import { createReviewRecord } from "../src/core/reviewRecords";
import { applyCleanupPlan, buildCleanupPlan } from "../src/utils/sessionsCli";

const dirs: string[] = [];
function tempDir(): string { const dir = mkdtempSync(join(tmpdir(), "diffle-cleanup-")); dirs.push(dir); return dir; }
beforeEach(() => { process.env.NITTLE_DATA_DIR = tempDir(); });
afterEach(() => { delete process.env.NITTLE_DATA_DIR; while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true }); });

function entry(overrides: Partial<SessionEntry> = {}): SessionEntry {
  return {
    sessionId: randomUUID(), reviewId: "r1", pid: 1, port: 1, url: "http://localhost:1",
    cwd: "/tmp", host: "cli", startedAt: new Date().toISOString(), ...overrides,
  };
}

describe("buildCleanupPlan", () => {
  it("always deletes every stale entry", () => {
    const stale = entry();
    expect(buildCleanupPlan([], [stale], { yes: true, all: false }).toDelete).toEqual([stale]);
  });

  it("without --all, only stops live sessions whose record is finished or missing", () => {
    const activeRecord = createReviewRecord({ target: { cwd: "/tmp/repo", ref: "main" } });
    const active = entry({ reviewId: activeRecord.id });
    const missing = entry({ reviewId: "no-such-review" });
    const plan = buildCleanupPlan([active, missing], [], { yes: true, all: false });
    expect(plan.toStop).toEqual([missing]);
  });

  it("--all stops every live session regardless of status", () => {
    const activeRecord = createReviewRecord({ target: { cwd: "/tmp/repo", ref: "main" } });
    const active = entry({ reviewId: activeRecord.id });
    const plan = buildCleanupPlan([active], [], { yes: true, all: true });
    expect(plan.toStop).toEqual([active]);
  });
});

describe("applyCleanupPlan", () => {
  it("unregisters every stale entry and reports which stoppers returned false", async () => {
    const staleA = entry();
    const staleB = entry();
    registerSession(staleA);
    registerSession(staleB);
    const okEntry = entry();
    const failEntry = entry();
    const outcomes = new Map([[okEntry.sessionId, true], [failEntry.sessionId, false]]);
    const stopper = async (e: SessionEntry) => outcomes.get(e.sessionId) ?? false;

    const failed = await applyCleanupPlan({ toDelete: [staleA, staleB], toStop: [okEntry, failEntry] }, stopper);

    expect(failed).toEqual([failEntry]);
    expect(listSessions().some((e) => e.sessionId === staleA.sessionId)).toBe(false);
    expect(listSessions().some((e) => e.sessionId === staleB.sessionId)).toBe(false);
  });

  it("reports no failures when every stop succeeds", async () => {
    const okEntry = entry();
    const failed = await applyCleanupPlan({ toDelete: [], toStop: [okEntry] }, async () => true);
    expect(failed).toEqual([]);
  });
});
