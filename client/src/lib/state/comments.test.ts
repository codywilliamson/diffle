import { describe, it, expect } from "vitest";
import { REVIEW_SCHEMA_VERSION } from "$types";
import type { Comment, DiffFile, DiffResult, ReviewFile, ReviewRecord } from "$types";
import { createReviewStore } from "./review.svelte";
import { createCommentsStore, type CommentsDeps } from "./comments.svelte";

const rec = (over: Partial<ReviewRecord> = {}): ReviewRecord => ({
  schemaVersion: REVIEW_SCHEMA_VERSION,
  id: "r1",
  target: { cwd: "/x", ref: "HEAD" },
  policy: "handoff",
  status: "awaiting_human",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  viewed: [],
  comments: [],
  activity: [],
  ...over,
});

const legacy = (comments: Comment[] = []): ReviewFile => ({
  meta: { ref: "HEAD", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" },
  viewed: [],
  comments,
});

const cmt = (id: string, over: Partial<Comment> = {}): Comment => ({
  id, file: "a.ts", line: 1, lineContent: "x", text: "t", createdAt: "2026-01-01T00:00:00Z", ...over,
});

const dfile = (path: string): DiffFile => ({
  path, oldPath: null, changeType: "modified", additions: 1, deletions: 0,
  hunks: [{ header: "@@", lines: [{ type: "addition", oldLine: null, newLine: 1, content: "x" }] }],
});

const diff = (paths: string[]): DiffResult => ({ ref: "", files: paths.map(dfile) });

const cdeps = (over: Partial<CommentsDeps> = {}): CommentsDeps => ({
  saveComments: async (comments) => rec({ comments }),
  resolveReviewComment: async () => rec(),
  replyToReviewComment: async () => rec(),
  ...over,
});

// a review store pre-seeded with a record (or legacy file) for the comments store to derive from.
const seeded = (data: ReviewRecord | ReviewFile) => {
  const review = createReviewStore();
  review.adopt(data);
  return review;
};

describe("comments store — mutations adopt the server record", () => {
  it("adds a comment via saveComments and adopts the response", async () => {
    const review = seeded(rec({ comments: [cmt("1")] }));
    let saved: Comment[] = [];
    const store = createCommentsStore(review, () => null, cdeps({ saveComments: async (c) => { saved = c; return rec({ comments: c }); } }));
    await store.add(cmt("2"));
    expect(saved.map((c) => c.id)).toEqual(["1", "2"]);
    expect(store.comments.map((c) => c.id)).toEqual(["1", "2"]);
  });

  it("edits a comment through saveComments", async () => {
    const review = seeded(rec({ comments: [cmt("1", { text: "old" })] }));
    const store = createCommentsStore(review, () => null, cdeps());
    await store.edit("1", { text: "new" });
    expect(store.comments[0]!.text).toBe("new");
  });

  it("removes a comment through saveComments", async () => {
    const review = seeded(rec({ comments: [cmt("1"), cmt("2")] }));
    const store = createCommentsStore(review, () => null, cdeps());
    await store.remove("1");
    expect(store.comments.map((c) => c.id)).toEqual(["2"]);
  });

  it("resolves, reopens, and replies via record-only endpoints", async () => {
    const review = seeded(rec({ comments: [cmt("1")] }));
    const calls: string[] = [];
    const store = createCommentsStore(review, () => null, cdeps({
      resolveReviewComment: async (_id, cid, status) => { calls.push(`${status}:${cid}`); return rec({ comments: [cmt(cid, { status: status === "resolved" ? "resolved" : "open" })] }); },
      replyToReviewComment: async (_id, cid, text) => { calls.push(`reply:${cid}:${text}`); return rec(); },
    }));
    await store.resolve("1");
    await store.reopen("1");
    await store.reply("1", "hi");
    expect(calls).toEqual(["resolved:1", "open:1", "reply:1:hi"]);
  });
});

describe("comments store — legacy mode", () => {
  it("saves through saveComments but refuses reply/resolve", async () => {
    const review = seeded(legacy([cmt("1")]));
    let saved = false;
    const store = createCommentsStore(review, () => null, cdeps({ saveComments: async (c) => { saved = true; return legacy(c); } }));
    await store.add(cmt("2"));
    expect(saved).toBe(true);
    await store.resolve("1");
    expect(store.error).toBe("not available on a legacy review");
    await store.reply("1", "x");
    expect(store.error).toBe("not available on a legacy review");
  });
});

describe("comments store — anchoring", () => {
  it("partitions comments into anchored and stale against the current diff", () => {
    const review = seeded(rec({ comments: [cmt("keep", { file: "a.ts" }), cmt("drop", { file: "gone.ts" })] }));
    const store = createCommentsStore(review, () => diff(["a.ts"]), cdeps());
    expect(store.anchored.map((c) => c.id)).toEqual(["keep"]);
    expect(store.stale.map((c) => c.id)).toEqual(["drop"]);
  });

  it("treats every comment as stale when there is no diff yet", () => {
    const review = seeded(rec({ comments: [cmt("1")] }));
    const store = createCommentsStore(review, () => null, cdeps());
    expect(store.anchored).toEqual([]);
    expect(store.stale.map((c) => c.id)).toEqual(["1"]);
  });
});
