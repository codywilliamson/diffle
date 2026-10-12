import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { addAgentComment } from "../src/core/agentComments";
import { pendingComments } from "../src/core/reviewInbox";
import { cancelReview, createReviewRecord, readReviewRecord, replyToComment } from "../src/core/reviewRecords";

const dirs: string[] = [];
function tempDir(): string { const dir = mkdtempSync(join(tmpdir(), "loupe-agent-comments-")); dirs.push(dir); return dir; }
const makeRecord = () => createReviewRecord({ target: { cwd: tempDir(), ref: "main" } });

beforeEach(() => { process.env.LOUPE_DATA_DIR = tempDir(); });
afterEach(() => { delete process.env.LOUPE_DATA_DIR; while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true }); });

describe("addAgentComment", () => {
  it("stores an open agent-authored line-range comment", () => {
    const record = makeRecord();
    const updated = addAgentComment(record.id, { file: "src/a.ts", line: 3, endLine: 5, side: "old", text: "edge case untested", tag: "issue" });
    expect(updated.comments).toEqual([expect.objectContaining({
      author: "agent", file: "src/a.ts", line: 3, endLine: 5, side: "old", lineContent: null, text: "edge case untested", tag: "issue", status: "open",
    })]);
    expect(readReviewRecord(record.id)?.comments).toEqual(updated.comments);
  });

  it("stores a file-level comment without line fields", () => {
    const comment = addAgentComment(makeRecord().id, { file: "README.md", text: "docs lag the code" }).comments[0]!;
    expect(comment).toMatchObject({ line: null, author: "agent" });
    expect(comment).not.toHaveProperty("side");
    expect(comment).not.toHaveProperty("endLine");
  });

  it("rejects an inconsistent range", () => {
    const { id } = makeRecord();
    expect(() => addAgentComment(id, { file: "a.ts", endLine: 2, text: "x" })).toThrow("side and endLine need a line");
    expect(() => addAgentComment(id, { file: "a.ts", side: "old", text: "x" })).toThrow("side and endLine need a line");
    expect(() => addAgentComment(id, { file: "a.ts", line: 5, endLine: 4, text: "x" })).toThrow("endLine must not be before line");
  });

  it("reaches the agent's inbox only after the reviewer replies", () => {
    const { id } = makeRecord();
    const added = addAgentComment(id, { file: "a.ts", line: 1, text: "should this be async?" });
    expect(pendingComments(added)).toEqual([]);
    const answered = replyToComment(id, added.comments[0]!.id, "yes", "reviewer");
    expect(pendingComments(answered).map((comment) => comment.text)).toEqual(["should this be async?"]);
  });

  it("refuses a terminal review", () => {
    const { id } = makeRecord();
    cancelReview(id);
    expect(() => addAgentComment(id, { file: "a.ts", text: "late" })).toThrow("review record is terminal");
  });
});
