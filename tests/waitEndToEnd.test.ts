import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ReviewRecord, ReviewSuggestion } from "../src/types";
import { readReviewRecord } from "../src/core/reviewRecords";
import { EXIT_CANCELLED, EXIT_RETURNED, EXIT_STOPPED, EXIT_TAB_CLOSED } from "../src/core/waitExit";
import { listSessions, stopSession } from "../src/core/sessions";
import { fixtureComment, makeFixtureRepo, startWait } from "./helpers/waitRun";

let repo: string;
let data: string;
const GRACE_ENV = { NITTLE_WAIT_GRACE_MS: "300" };

beforeAll(() => {
  repo = makeFixtureRepo();
  data = mkdtempSync(join(tmpdir(), "nittle-wait-data-"));
  process.env.NITTLE_DATA_DIR = data;
});
afterAll(() => {
  delete process.env.NITTLE_DATA_DIR;
  rmSync(repo, { recursive: true, force: true });
  rmSync(data, { recursive: true, force: true });
});

const env = () => ({ NITTLE_DATA_DIR: data, ...GRACE_ENV });

describe("nittle --wait", () => {
  it("prints the compiled prompt on stdout when feedback is returned", async () => {
    const run = await startWait(repo, [], env());
    await run.addComment();
    expect((await run.outcome("feedback")).status).toBe(200);
    expect(await run.exited).toBe(EXIT_RETURNED);
    const out = await run.stdout;
    expect(out).toContain("## Code Review");
    expect(out).toContain("why the bump?");
    expect(out).not.toContain("http://127.0.0.1");
    expect(run.stderr()).toContain(run.origin);
    expect(readReviewRecord(run.reviewId)?.status).toBe("feedback_ready");
  });

  it("prints the get_review structure with --json", async () => {
    const run = await startWait(repo, ["--json"], env());
    await run.addComment();
    await run.outcome("feedback");
    expect(await run.exited).toBe(EXIT_RETURNED);
    const parsed = JSON.parse(await run.stdout) as { review: ReviewRecord };
    expect(parsed.review.id).toBe(run.reviewId);
    expect(parsed.review.status).toBe("feedback_ready");
    expect(parsed.review.comments).toHaveLength(1);
  });

  it("lists suggestions with --json for a default working-tree review", async () => {
    const run = await startWait(repo, ["--json"], env());
    const text = "bump it\n```suggestion\nconst a = 3;\n```";
    await run.post("/api/comments", { comments: [{ ...fixtureComment, text }] });
    await run.outcome("feedback");
    expect(await run.exited).toBe(EXIT_RETURNED);
    const parsed = JSON.parse(await run.stdout) as { review: ReviewRecord; suggestions: ReviewSuggestion[]; suggestionsError?: string };
    expect(parsed.review.target.spec).toBe("working");
    expect(parsed.suggestionsError).toBeUndefined();
    expect(parsed.suggestions).toEqual([
      { commentId: "c1", path: "a.ts", side: "new", startLine: 1, endLine: 1, original: ["const a = 2;"], suggested: ["const a = 3;"] },
    ]);
  });

  it("exits 0 with empty stdout when approved", async () => {
    const run = await startWait(repo, [], env());
    expect((await run.outcome("approved")).status).toBe(200);
    expect(await run.exited).toBe(EXIT_RETURNED);
    expect(await run.stdout).toBe("");
    expect(readReviewRecord(run.reviewId)?.status).toBe("approved");
  });

  it("prints the approved record as JSON with --json and exits 0", async () => {
    const run = await startWait(repo, ["--json"], env());
    await run.outcome("approved");
    expect(await run.exited).toBe(EXIT_RETURNED);
    const parsed = JSON.parse(await run.stdout) as { review: ReviewRecord };
    expect(parsed.review.id).toBe(run.reviewId);
    expect(parsed.review.status).toBe("approved");
  });

  it("exits 2 with empty stdout when cancelled", async () => {
    const run = await startWait(repo, [], env());
    await run.outcome("cancelled");
    expect(await run.exited).toBe(EXIT_CANCELLED);
    expect(await run.stdout).toBe("");
  });

  it("exits 3 with a resume hint when the last tab closes without feedback", async () => {
    const run = await startWait(repo, [], env());
    await run.addComment();
    const tab = await run.openTab();
    tab.close();
    expect(await run.exited).toBe(EXIT_TAB_CLOSED);
    expect(await run.stdout).toBe("");
    expect(run.stderr()).toContain(`--review-id ${run.reviewId}`);
    expect(run.stderr()).toContain("get_review");
    const record = readReviewRecord(run.reviewId);
    expect(record?.status).toBe("awaiting_human");
    expect(record?.comments).toHaveLength(1);
  });

  it("treats a reload inside the grace period as the same session", async () => {
    const run = await startWait(repo, [], { NITTLE_DATA_DIR: data, NITTLE_WAIT_GRACE_MS: "2000" });
    await run.addComment();
    (await run.openTab()).close();
    await Bun.sleep(100);
    await run.openTab();
    await Bun.sleep(300);
    await run.outcome("feedback");
    expect(await run.exited).toBe(EXIT_RETURNED);
    expect(await run.stdout).toContain("why the bump?");
  });

  it("exits 4 with a resume hint when the session is stopped from outside", async () => {
    const run = await startWait(repo, [], env());
    const entry = listSessions().find((s) => s.reviewId === run.reviewId)!;
    expect(await stopSession(entry)).toBe(true);
    expect(await run.exited).toBe(EXIT_STOPPED);
    expect(await run.stdout).toBe("");
    expect(run.stderr()).toContain(`--review-id ${run.reviewId}`);
    expect(readReviewRecord(run.reviewId)?.status).toBe("awaiting_human");
  });

  it("returns feedback even if the tab closes right after sending it", async () => {
    const run = await startWait(repo, [], env());
    await run.addComment();
    const tab = await run.openTab();
    await run.outcome("feedback");
    tab.close();
    expect(await run.exited).toBe(EXIT_RETURNED);
    expect(await run.stdout).toContain("why the bump?");
  });
});
