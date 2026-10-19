import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createReviewRecord, findActiveReview, findActiveReviewForOrigin } from "../src/core/reviewRecords";

// each test cold-starts the cli two to four times plus a dozen git calls, so the 10s default is
// a coin flip on a busy machine
const CLI_SPAWN_TEST_TIMEOUT_MS = 60_000;
const dirs: string[] = [];
const temp = (name: string) => { const dir = mkdtempSync(join(tmpdir(), name)); dirs.push(dir); return dir; };
const git = (args: string[], cwd: string) => Bun.spawnSync(["git", ...args], { cwd });
afterEach(() => { delete process.env.NITTLE_DATA_DIR; while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true }); });

describe("completion hook", () => {
  test("creates one required review and deduplicates later stops in the same chat", () => {
    const repo = temp("nittle-hook-repo-"); const data = temp("nittle-hook-data-"); process.env.NITTLE_DATA_DIR = data;
    git(["init", "-q", "-b", "main"], repo); git(["config", "user.name", "t"], repo); git(["config", "user.email", "t@e.com"], repo);
    writeFileSync(join(repo, "a.ts"), "one\n"); git(["add", "-A"], repo); git(["commit", "-q", "-m", "init"], repo); writeFileSync(join(repo, "a.ts"), "two\n");
    const env = { ...process.env, NITTLE_DATA_DIR: data, NITTLE_HOOK_NO_SPAWN: "1" } as Record<string, string>;
    const run = () => Bun.spawnSync(["bun", join(import.meta.dir, "..", "src", "index.ts"), "hook", "stop", "--agent", "claude-code"], { cwd: repo, env, stdin: new Blob([JSON.stringify({ cwd: repo, session_id: "s1", last_assistant_message: "done" })]) });
    expect(run().exitCode).toBe(0); const first = findActiveReview(repo); expect(first?.origin?.sessionId).toBe("s1"); expect(first?.policy).toBe("required");
    expect(run().exitCode).toBe(0); expect(findActiveReview(repo)?.id).toBe(first?.id);
  }, CLI_SPAWN_TEST_TIMEOUT_MS);

  test("does not claim a review from another chat or a human", () => {
    const repo = temp("nittle-hook-repo-"); const data = temp("nittle-hook-data-"); process.env.NITTLE_DATA_DIR = data;
    git(["init", "-q", "-b", "main"], repo); git(["config", "user.name", "t"], repo); git(["config", "user.email", "t@e.com"], repo);
    writeFileSync(join(repo, "a.ts"), "one\n"); git(["add", "-A"], repo); git(["commit", "-q", "-m", "init"], repo); writeFileSync(join(repo, "a.ts"), "two\n");
    createReviewRecord({ target: { cwd: repo, ref: "working tree" } });
    const env = { ...process.env, NITTLE_DATA_DIR: data, NITTLE_HOOK_NO_SPAWN: "1" } as Record<string, string>;
    const run = (payload: object) => Bun.spawnSync(["bun", join(import.meta.dir, "..", "src", "index.ts"), "hook", "stop", "--agent", "claude-code"], { cwd: repo, env, stdin: new Blob([JSON.stringify({ cwd: repo, ...payload })]) });
    expect(run({ session_id: "s1" }).stdout.toString()).toContain("opened");
    const first = findActiveReviewForOrigin(repo, { agent: "claude-code", sessionId: "s1" })!;
    expect(first.origin?.sessionId).toBe("s1");
    expect(run({ session_id: "s2" }).stdout.toString()).toContain("opened");
    const second = findActiveReviewForOrigin(repo, { agent: "claude-code", sessionId: "s2" })!;
    expect(second.id).not.toBe(first.id);
    expect(second.origin?.sessionId).toBe("s2");
    expect(run({}).stdout.toString()).toContain("opened");
  }, CLI_SPAWN_TEST_TIMEOUT_MS);
});
