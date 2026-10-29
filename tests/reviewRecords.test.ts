import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  approveReview, cancelReview, createReviewRecord, detectLegacyReview, findActiveReview, importLegacyReview,
  findActiveReviewForOrigin, markCommentAddressed, readReviewRecord, removeLegacyReview, replyToComment, requestRereview,
  returnFeedback, setCommentStatus, updateReviewRecord,
} from "../src/core/reviewRecords";

const dirs: string[] = [];
const comment = { id: "c1", file: "src/a.ts", line: 4, lineContent: "+new", text: "please fix", createdAt: "2026-01-01T00:00:00.000Z" };
function tempDir(): string { const dir = mkdtempSync(join(tmpdir(), "nittle-records-")); dirs.push(dir); return dir; }
function makeRecord(cwd = tempDir()) { return createReviewRecord({ target: { cwd, ref: "main" }, comments: [comment], viewed: ["src/a.ts"] }); }

beforeEach(() => { process.env.NITTLE_DATA_DIR = tempDir(); });
afterEach(() => { delete process.env.NITTLE_DATA_DIR; while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true }); });

describe("review records", () => {
  it("creates, reads, updates, and atomically stores a record under the user root", () => {
    const record = makeRecord();
    expect(readReviewRecord(record.id)).toEqual(record);
    const updated = updateReviewRecord(record.id, { summary: "needs work" });
    expect(updated.summary).toBe("needs work");
    const path = join(process.env.NITTLE_DATA_DIR!, "reviews", record.id, "review.json");
    expect(existsSync(path)).toBe(true); expect(readFileSync(path, "utf8")).toContain('"schemaVersion": 1');
  });

  it("rejects invalid or escaping IDs", () => {
    expect(() => readReviewRecord("../outside")).toThrow("invalid review id");
    expect(() => updateReviewRecord("a/b", {})).toThrow("invalid review id");
  });

  it("detects, imports without deleting, and explicitly removes legacy reviews", () => {
    const cwd = tempDir();
    writeFileSync(join(cwd, ".review"), JSON.stringify({ meta: { ref: "feature", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-02T00:00:00.000Z" }, viewed: ["a.ts"], comments: [{ ...comment, tag: "issue", resolved: true }] }));
    expect(detectLegacyReview(cwd)).toBe(true);
    const record = importLegacyReview("legacy-1", cwd);
    expect(existsSync(join(cwd, ".review"))).toBe(true);
    expect(record.id).toBe("legacy-1"); expect(record.viewed).toEqual(["a.ts"]);
    expect(record.comments[0]!.tag).toBe("issue"); expect(record.comments[0]!.status).toBe("resolved");
    expect(removeLegacyReview(cwd)).toBe(true); expect(detectLegacyReview(cwd)).toBe(false); expect(removeLegacyReview(cwd)).toBe(false);
  });

  it("protects terminal states while retaining readable records", () => {
    const source = makeRecord(); expect(findActiveReview(source.target.cwd)?.id).toBe(source.id);
    const approved = approveReview(source.id, true);
    expect(readReviewRecord(approved.id)?.status).toBe("approved");
    expect(findActiveReview(source.target.cwd)).toBeNull();
    expect(() => updateReviewRecord(approved.id, { summary: "late" })).toThrow("terminal");
    const cancelled = cancelReview(makeRecord().id);
    expect(readReviewRecord(cancelled.id)?.status).toBe("cancelled");
    expect(() => requestRereview(cancelled.id)).toThrow("terminal");
  });

  it("treats a repeat cancel as a no-op, but never cancels an approved review", () => {
    const first = cancelReview(makeRecord().id);
    const again = cancelReview(first.id, "late");
    expect(again.status).toBe("cancelled");
    expect(again.activity).toHaveLength(first.activity.length);
    expect(() => cancelReview(approveReview(makeRecord().id, true).id)).toThrow("terminal");
  });

  it("scopes active lookup to the originating agent session", () => {
    const cwd = tempDir();
    const human = createReviewRecord({ target: { cwd, ref: "main" } });
    const sameSession = createReviewRecord({ target: { cwd, ref: "main" }, origin: { agent: "claude-code", sessionId: "s1", taskId: "old-task" } });
    const newest = createReviewRecord({ target: { cwd, ref: "main" }, origin: { agent: "claude-code", sessionId: "s1", taskId: "new-task" } });
    updateReviewRecord(newest.id, { summary: "newest" });
    const terminal = createReviewRecord({ target: { cwd, ref: "main" }, origin: { agent: "claude-code", sessionId: "s1", taskId: "done" } });
    approveReview(terminal.id, true);
    const taskOnly = createReviewRecord({ target: { cwd, ref: "main" }, origin: { agent: "claude-code", taskId: "task-only" } });
    createReviewRecord({ target: { cwd, ref: "main" }, origin: { agent: "claude-code", sessionId: "s2", taskId: "shared-task" } });

    expect(findActiveReviewForOrigin(cwd, { agent: "claude-code", sessionId: "s1", taskId: "changed" })?.id).toBe(newest.id);
    expect(findActiveReviewForOrigin(cwd, { agent: "claude-code", taskId: "task-only" })?.id).toBe(taskOnly.id);
    expect(findActiveReviewForOrigin(cwd, { agent: "claude-code", sessionId: "s3", taskId: "shared-task" })).toBeNull();
    expect(findActiveReviewForOrigin(cwd, { agent: "codex", sessionId: "s1", taskId: "new-task" })).toBeNull();
    expect(findActiveReviewForOrigin(cwd, { agent: "claude-code", sessionId: "missing" })).toBeNull();
    expect(findActiveReviewForOrigin(cwd, { agent: "claude-code" })).toBeNull();
    expect(readReviewRecord(human.id)?.origin).toBeUndefined();
  });

  it("reopens an approved review when the agent requests rereview", () => {
    const record = makeRecord();
    const approved = approveReview(record.id, true);
    expect(approved.status).toBe("approved");
    const reopened = requestRereview(approved.id, "one more pass");
    expect(reopened.status).toBe("awaiting_human");
    expect(reopened.activity.some((item) => item.type === "review_approved")).toBe(true);
    expect(reopened.activity.findLast((item) => item.type === "rereview_requested")?.summary).toBe("one more pass");
  });

  it("completes a second full review cycle after being reopened", () => {
    const record = makeRecord();
    approveReview(record.id, true);
    requestRereview(record.id, "one more pass");
    const feedbackReady = returnFeedback(record.id, "still needs work");
    expect(feedbackReady.status).toBe("feedback_ready");
    const rereviewed = requestRereview(feedbackReady.id, "fixed it");
    expect(rereviewed.status).toBe("awaiting_human");
    const approvedAgain = approveReview(rereviewed.id, true);
    expect(approvedAgain.status).toBe("approved");
  });

  it("keeps updatedAt strictly increasing across back-to-back mutations", () => {
    const record = makeRecord();
    const first = replyToComment(record.id, "c1", "first", "agent");
    const second = replyToComment(record.id, "c1", "second", "agent");
    expect(second.updatedAt > first.updatedAt).toBe(true);
  });

  it("requires acknowledgement when approving unresolved comments", () => {
    const record = makeRecord();
    expect(() => approveReview(record.id)).toThrow("acknowledging unresolved");
    expect(approveReview(record.id, true).status).toBe("approved");
  });

  it("allows only reviewers to resolve and agents to address/reply", () => {
    const record = makeRecord();
    expect(() => setCommentStatus(record.id, "c1", "resolved", "agent")).toThrow("only the reviewer");
    expect(markCommentAddressed(record.id, "c1").comments[0]!.status).toBe("addressed");
    const replied = replyToComment(record.id, "c1", "fixed", "agent");
    expect(replied.comments[0]!.replies?.[0]!.author).toBe("agent");
    expect(setCommentStatus(record.id, "c1", "resolved", "reviewer").comments[0]!.resolved).toBe(true);
    expect(replyToComment(record.id, "c1", "follow-up", "agent").comments[0]!.status).toBe("resolved");
    expect(() => markCommentAddressed(record.id, "c1")).toThrow("reopened by the reviewer");
    expect(() => setCommentStatus(record.id, "c1", "open", "agent")).toThrow("only the reviewer");
  });

  it("records lifecycle activity and rereview transitions", () => {
    const record = makeRecord();
    expect(returnFeedback(record.id, "reviewer note").status).toBe("feedback_ready");
    const rereview = requestRereview(record.id, "agent update");
    expect(rereview.status).toBe("awaiting_human");
    expect(rereview.summary).toBe("reviewer note");
    expect(rereview.activity.findLast((item) => item.type === "rereview_requested")?.summary).toBe("agent update");
    const types = rereview.activity.map((item) => item.type);
    expect(types).toEqual(expect.arrayContaining(["review_started", "feedback_returned", "rereview_requested"]));
  });

  it("stores a reviewer reply and logs comment_replied with actor reviewer", () => {
    const record = makeRecord();
    const replied = replyToComment(record.id, "c1", "thanks, looks good", "reviewer");
    const reply = replied.comments[0]!.replies?.[0]!;
    expect(reply.author).toBe("reviewer");
    expect(reply.text).toBe("thanks, looks good");
    const logged = replied.activity.findLast((item) => item.type === "comment_replied");
    expect(logged?.actor).toBe("reviewer");
    expect(logged?.commentId).toBe("c1");
  });

  it("requires unresolved feedback and a feedback-ready rereview", () => {
    const empty = createReviewRecord({ target: { cwd: tempDir(), ref: "main" } });
    expect(() => returnFeedback(empty.id)).toThrow("requires an unresolved comment or a summary");
    expect(() => returnFeedback(empty.id, "   ")).toThrow("requires an unresolved comment or a summary");
    const record = makeRecord();
    expect(() => requestRereview(record.id)).toThrow("requires returned feedback");
    returnFeedback(record.id);
    expect(() => returnFeedback(record.id)).toThrow("awaiting the reviewer");
    expect(() => approveReview(record.id, true)).toThrow("awaiting the reviewer");
  });

  it("returns summary-only feedback with no unresolved comments", () => {
    const empty = createReviewRecord({ target: { cwd: tempDir(), ref: "main" } });
    const result = returnFeedback(empty.id, "Tighten the error path.");
    expect(result.status).toBe("feedback_ready");
    expect(result.summary).toBe("Tighten the error path.");
    expect(result.activity.findLast((item) => item.type === "feedback_returned")?.summary).toBe("Tighten the error path.");
  });
});
