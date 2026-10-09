import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Server } from "bun";
import type { ApiError, DiffResult, ReviewScorecard } from "../src/types";
import { createServer } from "../src/server/router";
import { directoryAssets } from "../src/server/assetSource";
import { createReviewRecord, updateReviewRecord } from "../src/core/reviewRecords";
import { captureRound } from "../src/core/reviewRounds";

const dirs: string[] = [];
const tempDir = () => { const dir = mkdtempSync(join(tmpdir(), "scorecard-")); dirs.push(dir); return dir; };
const diff: DiffResult = {
  ref: "working tree",
  files: [{ path: "a.py", oldPath: null, changeType: "added", additions: 1, deletions: 0, hunks: [{ header: "@@ -0,0 +1 @@", lines: [{ type: "addition", oldLine: null, newLine: 1, content: "one" }] }] }],
};
let server: Server<undefined>;
let repo: string;

const start = (over: Partial<Parameters<typeof createServer>[0]> = {}) => {
  server = createServer({ diff, cwd: repo, assets: directoryAssets(repo), loupeRoot: repo, newRef: null, diffArgs: ["diff", "HEAD"], includeUntracked: true, served: true, host: "cli", ...over });
};
const get = () => fetch(`http://localhost:${server.port}/api/scorecard`);

beforeEach(() => {
  process.env.LOUPE_DATA_DIR = tempDir();
  repo = tempDir();
  Bun.spawnSync(["git", "init", "-q"], { cwd: repo });
  writeFileSync(join(repo, "a.py"), "one\n");
});
afterEach(() => { server.stop(true); delete process.env.LOUPE_DATA_DIR; while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true }); });

describe("GET /api/scorecard", () => {
  it("returns the scorecard for the current diff", async () => {
    start();
    const card = await (await get()).json() as ReviewScorecard;
    expect(card.totals).toMatchObject({ files: 1, additions: 1, effectiveLines: 1 });
    expect(card.categories.map((c) => c.id)).toEqual(["size", "tests", "api", "dependencies", "hotspots", "flags"]);
    expect(card.files[0]).toMatchObject({ path: "a.py", changedSinceReview: null });
  });

  it("404s in browse mode", async () => {
    start({ mode: "browse" });
    const res = await get();
    expect(res.status).toBe(404);
    expect((await res.json() as ApiError).error).toBe("scorecard is only available for diffs");
  });

  it("marks files changed since the last review round", async () => {
    const reviewId = createReviewRecord({ target: { cwd: repo, ref: "HEAD" } }).id;
    updateReviewRecord(reviewId, { lastRound: captureRound(repo, null, ["a.py"]) });
    start({ reviewId });
    expect(((await (await get()).json()) as ReviewScorecard).files[0]!.changedSinceReview).toBe(false);
    writeFileSync(join(repo, "a.py"), "one\ntwo\n");
    expect(((await (await get()).json()) as ReviewScorecard).files[0]!.changedSinceReview).toBe(true);
  });
});
