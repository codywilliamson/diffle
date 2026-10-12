import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Comment, CommentReply } from "../src/types";
import { pendingComments, waitForComments } from "../src/core/reviewInbox";
import { cancelReview, createReviewRecord, markCommentAddressed, replyToComment, returnFeedback, setCommentStatus } from "../src/core/reviewRecords";

const dirs: string[] = [];
function tempDir(): string { const dir = mkdtempSync(join(tmpdir(), "loupe-inbox-")); dirs.push(dir); return dir; }
const reply = (author: CommentReply["author"]): CommentReply => ({ id: `r-${author}`, author, text: "…", createdAt: "2026-01-01T00:00:00.000Z" });
function comment(id: string, extra: Partial<Comment> = {}): Comment {
  return { id, file: "src/a.ts", line: 4, lineContent: "+new", text: "please fix", createdAt: "2026-01-01T00:00:00.000Z", ...extra };
}
const makeRecord = (comments: Comment[]) => createReviewRecord({ target: { cwd: tempDir(), ref: "main" }, comments });
const ids = (comments: Comment[]) => comments.map((item) => item.id);

beforeEach(() => { process.env.LOUPE_DATA_DIR = tempDir(); });
afterEach(() => { delete process.env.LOUPE_DATA_DIR; while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true }); });

describe("pendingComments", () => {
  it("queues a comment only while the reviewer spoke last and it is unresolved", () => {
    const record = makeRecord([
      comment("fresh"),
      comment("legacy-open", { resolved: false }),
      comment("answered", { replies: [reply("agent")] }),
      comment("followed-up", { replies: [reply("agent"), reply("reviewer")] }),
      comment("addressed-silent", { status: "addressed" }),
      comment("addressed-followed-up", { status: "addressed", replies: [reply("agent"), reply("reviewer")] }),
      comment("resolved", { status: "resolved", replies: [reply("reviewer")] }),
      comment("legacy-resolved", { resolved: true }),
    ]);
    expect(ids(pendingComments(record))).toEqual(["fresh", "legacy-open", "followed-up", "addressed-followed-up"]);
  });
});

describe("waitForComments", () => {
  it("returns at once when a comment is pending", async () => {
    const record = makeRecord([comment("c1")]);
    const result = await waitForComments(record.id, 5_000);
    expect(result.timedOut).toBe(false);
    expect(ids(result.pending)).toEqual(["c1"]);
  });

  it("times out empty when nothing waits on the agent", async () => {
    const record = makeRecord([comment("c1", { replies: [reply("agent")] })]);
    const result = await waitForComments(record.id, 30, undefined, 5);
    expect(result).toMatchObject({ timedOut: true, pending: [] });
  });

  it("wakes when the reviewer replies mid-wait", async () => {
    const record = makeRecord([comment("c1")]);
    replyToComment(record.id, "c1", "on it", "agent"); markCommentAddressed(record.id, "c1");
    setTimeout(() => replyToComment(record.id, "c1", "still wrong", "reviewer"), 20);
    const result = await waitForComments(record.id, 5_000, undefined, 5);
    expect(result.timedOut).toBe(false);
    expect(result.pending[0]?.replies?.at(-1)?.text).toBe("still wrong");
  });

  it("returns when the review leaves awaiting_human", async () => {
    const record = makeRecord([comment("c1", { replies: [reply("agent")] })]);
    setTimeout(() => returnFeedback(record.id, "batch done"), 20);
    const result = await waitForComments(record.id, 5_000, undefined, 5);
    expect(result).toMatchObject({ timedOut: false, review: { status: "feedback_ready", summary: "batch done" } });
  });

  it("returns at once for a cancelled review", async () => {
    const record = makeRecord([]);
    cancelReview(record.id);
    expect((await waitForComments(record.id, 5_000)).review.status).toBe("cancelled");
  });

  it("stops early when aborted", async () => {
    const record = makeRecord([comment("c1")]);
    setCommentStatus(record.id, "c1", "resolved", "reviewer");
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 20);
    const started = Date.now();
    const result = await waitForComments(record.id, 5_000, controller.signal, 5);
    expect(result.timedOut).toBe(true);
    expect(Date.now() - started).toBeLessThan(1_000);
  });

  it("rejects an unknown review", async () => {
    await expect(waitForComments("missing", 10)).rejects.toThrow("review record not found");
  });
});
