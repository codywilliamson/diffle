import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Server } from "bun";
import type { DiffResult, InterdiffResponse } from "../src/types";
import { createServer } from "../src/server/router";
import { directoryAssets } from "../src/server/assetSource";
import { createReviewRecord, readReviewRecord } from "../src/core/reviewRecords";

const dirs: string[] = [];
const tempDir = () => { const dir = mkdtempSync(join(tmpdir(), "interdiff-")); dirs.push(dir); return dir; };
const diff: DiffResult = { ref: "working tree", files: [{ path: "a.ts", oldPath: null, changeType: "added", additions: 1, deletions: 0, hunks: [] }] };
let server: Server<undefined>;
let repo: string;
let reviewId: string;

const post = (body: unknown) => fetch(`http://localhost:${server.port}/api/review/outcome`, {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});
const get = (path: string) => fetch(`http://localhost:${server.port}/api/interdiff?path=${path}`);

beforeEach(() => {
  process.env.LOUPE_DATA_DIR = tempDir();
  repo = tempDir();
  Bun.spawnSync(["git", "init", "-q"], { cwd: repo });
  writeFileSync(join(repo, "a.ts"), "one\n");
  reviewId = createReviewRecord({ target: { cwd: repo, ref: "HEAD" } }).id;
  server = createServer({ diff, cwd: repo, assets: directoryAssets(repo), loupeRoot: repo, newRef: null, diffArgs: ["diff", "HEAD"], includeUntracked: true, served: true, host: "cli", reviewId });
});
afterEach(() => { server.stop(true); delete process.env.LOUPE_DATA_DIR; while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true }); });

describe("GET /api/interdiff", () => {
  it("404s before any round, then captures on feedback and diffs later edits", async () => {
    expect((await get("a.ts")).status).toBe(404);
    expect((await post({ id: reviewId, outcome: "feedback", summary: "note" })).status).toBe(200);
    expect(readReviewRecord(reviewId)?.lastRound?.blobs["a.ts"]).toBeTruthy();
    const same = await (await get("a.ts")).json() as InterdiffResponse;
    expect(same).toEqual({ path: "a.ts", file: null });
    writeFileSync(join(repo, "a.ts"), "one\ntwo\n");
    const changed = await (await get("a.ts")).json() as InterdiffResponse;
    expect(changed.file?.additions).toBe(1);
  });

  it("rejects paths outside the diff and missing params", async () => {
    await post({ id: reviewId, outcome: "feedback", summary: "note" });
    expect((await get("other.ts")).status).toBe(400);
    expect((await fetch(`http://localhost:${server.port}/api/interdiff`)).status).toBe(400);
  });
});
