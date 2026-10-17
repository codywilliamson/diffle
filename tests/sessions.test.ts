import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SessionEntry } from "../src/core/sessions";
import { classifySessions, isPidAlive, listSessions, probeSession, registerSession, unregisterSession } from "../src/core/sessions";

const dirs: string[] = [];
function tempDir(): string { const dir = mkdtempSync(join(tmpdir(), "diffle-sessions-")); dirs.push(dir); return dir; }

beforeEach(() => { process.env.NITTLE_DATA_DIR = tempDir(); });
afterEach(() => { delete process.env.NITTLE_DATA_DIR; while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true }); });

// a pid unlikely to be alive on any platform, for testing the dead-pid branch.
const DEAD_PID = 2147483646;

function entry(overrides: Partial<SessionEntry> = {}): SessionEntry {
  return {
    sessionId: randomUUID(), reviewId: "r1", pid: process.pid, port: 4123, url: "http://localhost:4123",
    cwd: "/tmp/repo", host: "cli", startedAt: new Date().toISOString(), ...overrides,
  };
}

describe("session registry", () => {
  it("registers, lists, and unregisters a session", () => {
    const session = entry();
    registerSession(session);
    expect(listSessions()).toEqual([session]);
    unregisterSession(session.sessionId);
    expect(listSessions()).toEqual([]);
  });

  it("keeps two registrations for the same review id as separate entries", () => {
    registerSession(entry({ reviewId: "shared" }));
    registerSession(entry({ reviewId: "shared" }));
    const shared = listSessions().filter((e) => e.reviewId === "shared");
    expect(shared).toHaveLength(2);
    expect(shared[0]!.sessionId).not.toBe(shared[1]!.sessionId);
  });

  it("skips an unparseable file and one whose sessionId doesn't match its filename", () => {
    registerSession(entry());
    const dir = join(process.env.NITTLE_DATA_DIR!, "sessions");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "broken.json"), "{ not json");
    writeFileSync(join(dir, "mismatch.json"), JSON.stringify(entry({ sessionId: "someone-elses-id" })));
    expect(listSessions()).toHaveLength(1);
  });

  it("checks pid liveness, treating a dead pid as not alive", () => {
    expect(isPidAlive(process.pid)).toBe(true);
    expect(isPidAlive(DEAD_PID)).toBe(false);
  });

  it("classifies a dead-pid entry and an unreachable-url entry as stale", async () => {
    registerSession(entry({ reviewId: "dead-pid", pid: DEAD_PID }));
    registerSession(entry({ reviewId: "unreachable", pid: process.pid, port: 1, url: "http://localhost:1" }));
    const { live, stale } = await classifySessions();
    expect(live).toEqual([]);
    expect(stale.map((s) => s.reviewId).sort()).toEqual(["dead-pid", "unreachable"]);
  });

  it("probeSession returns false when the served review id doesn't match", async () => {
    const fake = Bun.serve({ port: 0, fetch: () => Response.json({ id: "someone-else" }) });
    try {
      const result = await probeSession(entry({ reviewId: "expected", url: `http://localhost:${fake.port}` }));
      expect(result).toBe(false);
    } finally { fake.stop(true); }
  });

  it("probeSession returns true when the served review id matches", async () => {
    const fake = Bun.serve({ port: 0, fetch: () => Response.json({ id: "matches" }) });
    try {
      const result = await probeSession(entry({ reviewId: "matches", url: `http://localhost:${fake.port}` }));
      expect(result).toBe(true);
    } finally { fake.stop(true); }
  });
});
