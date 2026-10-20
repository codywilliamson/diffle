import { describe, it, expect, vi } from "vitest";
import { REVIEW_SCHEMA_VERSION } from "$types";
import type { Comment, DiffFile, DiffResult, ReviewFile, ReviewRecord } from "$types";
import { createReviewStore, RESYNC_TIMEOUT_MS } from "./review.svelte";
import { createCommentsStore, WRITE_TIMEOUT_MS, type CommentsDeps } from "./comments.svelte";

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
  saveViewed: async (viewed) => rec({ viewed }),
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

  it("returns the write error so an editor can stay open and retry", async () => {
    const review = seeded(rec());
    const store = createCommentsStore(review, () => null, cdeps({ saveComments: async () => { throw new Error("disk full"); } }));
    await expect(store.add(cmt("1"))).resolves.toBe("disk full");
    expect(store.error).toBe("disk full");
    expect(store.comments).toEqual([]);
  });

  it("removes a comment through saveComments", async () => {
    const review = seeded(rec({ comments: [cmt("1"), cmt("2")] }));
    const store = createCommentsStore(review, () => null, cdeps());
    await store.remove("1");
    expect(store.comments.map((c) => c.id)).toEqual(["2"]);
  });

  it("serializes writes: two quick deletes never resurrect a comment", async () => {
    const review = seeded(rec({ comments: [cmt("1"), cmt("2"), cmt("3")] }));
    const releases: Array<() => void> = [];
    const store = createCommentsStore(review, () => null, cdeps({
      saveComments: (c) => new Promise((resolve) => releases.push(() => resolve(rec({ comments: c })))),
    }));
    const first = store.remove("1");
    const second = store.remove("2");
    await Promise.resolve();
    expect(releases).toHaveLength(1); // the second waits for the first
    releases[0]!();
    await first;
    await vi.waitFor(() => expect(releases).toHaveLength(2));
    releases[1]!();
    await second;
    expect(store.comments.map((c) => c.id)).toEqual(["3"]);
  });

  it("keeps the queue moving after a failed write", async () => {
    const review = withServer({ comments: [cmt("1")] });
    let fail = true;
    const store = createCommentsStore(review, () => null, cdeps({
      saveComments: async (c) => { if (fail) { fail = false; throw new Error("boom"); } return rec({ comments: c }); },
    }));
    const [a, b] = await Promise.all([store.add(cmt("2")), store.add(cmt("3"))]);
    expect(a).toBe("boom");
    expect(b).toBeNull();
    expect(store.comments.map((c) => c.id)).toEqual(["1", "3"]);
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

  it("returns a reply error so the composer can stay open and retry", async () => {
    const review = seeded(rec({ comments: [cmt("1")] }));
    const store = createCommentsStore(review, () => null, cdeps({
      replyToReviewComment: async () => { throw new Error("reply failed"); },
    }));

    await expect(store.reply("1", "Keep this draft")).resolves.toBe("reply failed");
    expect(store.error).toBe("reply failed");
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

describe("comments store — viewed + counts", () => {
  it("toggles a file's viewed mark through saveViewed and adopts the record", async () => {
    const review = seeded(rec({ viewed: [] }));
    let saved: string[] = [];
    const store = createCommentsStore(review, () => null, cdeps({ saveViewed: async (v) => { saved = v; return rec({ viewed: v }); } }));
    await store.toggleViewed("a.ts");
    expect(saved).toEqual(["a.ts"]);
    expect([...store.viewedSet]).toEqual(["a.ts"]);
    await store.toggleViewed("a.ts");
    expect([...store.viewedSet]).toEqual([]);
  });

  it("counts only unresolved comments per file", () => {
    const review = seeded(rec({ comments: [cmt("1", { file: "a.ts" }), cmt("2", { file: "a.ts", status: "resolved" }), cmt("3", { file: "b.ts" })] }));
    const store = createCommentsStore(review, () => null, cdeps());
    expect(store.countFor("a.ts")).toBe(1);
    expect(store.countFor("b.ts")).toBe(1);
    expect(store.countFor("c.ts")).toBe(0);
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

// a review store whose re-read returns whatever `server.comments` holds
const withServer = (server: { comments: Comment[] }, fail = () => false) => {
  const review = createReviewStore({
    getComments: async () => { if (fail()) throw new Error("offline"); return rec({ comments: server.comments }); },
    getReview: async () => rec(),
    submitReviewOutcome: async () => rec(),
    importLegacyReview: async () => rec(),
    ignoreLegacyReview: async () => ({ legacy: true, ignored: true }),
    removeLegacyReview: async () => ({ removed: true }),
  });
  review.adopt(rec({ comments: server.comments }));
  return review;
};

describe("comments store — delete safety", () => {
  it("shares one delete between two clicks and hands back the removed comment once", async () => {
    const review = seeded(rec({ comments: [cmt("1"), cmt("2")] }));
    let writes = 0;
    const store = createCommentsStore(review, () => null, cdeps({ saveComments: async (c) => { writes++; return rec({ comments: c }); } }));
    const [a, b] = await Promise.all([store.removeComment("1"), store.removeComment("1")]);
    expect(writes).toBe(1);
    expect(a).toBe(b);
    expect(a.removed?.id).toBe("1");
  });

  it("adding an id that already exists is a no-op, so a repeated undo cannot duplicate", async () => {
    const review = seeded(rec({ comments: [cmt("1")] }));
    const store = createCommentsStore(review, () => null, cdeps());
    await store.add(cmt("1"));
    await store.add(cmt("1"));
    expect(store.comments.map((c) => c.id)).toEqual(["1"]);
  });

  it("hands back the comment as the queued delete saw it: after a resolve and a reply", async () => {
    const review = seeded(rec({ comments: [cmt("1")] }));
    const store = createCommentsStore(review, () => null, cdeps({
      resolveReviewComment: async () => rec({ comments: [cmt("1", { status: "resolved" })] }),
      replyToReviewComment: async () => rec({ comments: [cmt("1", { status: "resolved", replies: [{ id: "r", author: "reviewer", text: "hi", createdAt: "x" }] })] }),
    }));
    void store.resolve("1");
    void store.reply("1", "hi");
    const { removed } = await store.removeComment("1");
    expect(removed?.status).toBe("resolved");
    expect(removed?.replies).toHaveLength(1);
  });

  it("rebases on the server after a write whose response was lost", async () => {
    const server = { comments: [cmt("A"), cmt("B")] };
    const review = withServer(server);
    let calls = 0;
    const sent: string[][] = [];
    const store = createCommentsStore(review, () => null, cdeps({
      saveComments: async (c) => {
        sent.push(c.map((x) => x.id));
        server.comments = c;
        if (calls++ === 0) throw new Error("response lost"); // applied, but we never heard
        return rec({ comments: c });
      },
    }));
    expect(await store.remove("A")).toBe("response lost");
    expect(await store.remove("B")).toBeNull();
    expect(sent).toEqual([["B"], []]); // B's delete did not resurrect A
    expect(store.comments).toEqual([]);
  });

  it("refuses the next write when the re-read fails too", async () => {
    const server = { comments: [cmt("A"), cmt("B")] };
    let down = false;
    const review = withServer(server, () => down);
    let saves = 0;
    const store = createCommentsStore(review, () => null, cdeps({ saveComments: async () => { saves++; down = true; throw new Error("offline"); } }));
    await store.remove("A");
    expect(await store.remove("B")).toMatch(/Could not confirm/);
    expect(saves).toBe(1);
  });

  it("times out a write that never settles and moves on", async () => {
    vi.useFakeTimers();
    try {
      const server = { comments: [cmt("A")] };
      const review = withServer(server);
      let first = true;
      const store = createCommentsStore(review, () => null, cdeps({
        saveComments: (c, signal) => {
          if (first) { first = false; return new Promise((_, reject) => signal?.addEventListener("abort", () => reject(new Error("aborted")))); }
          return Promise.resolve(rec({ comments: c }));
        },
      }));
      const hung = store.add(cmt("B"));
      const next = store.add(cmt("C"));
      await vi.advanceTimersByTimeAsync(WRITE_TIMEOUT_MS);
      expect(await hung).toBe("The server did not answer in time.");
      expect(await next).toBeNull();
      expect(store.comments.map((c) => c.id)).toEqual(["A", "C"]);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("comments store — timeouts reach the request", () => {
  it("aborts the record-mutation request itself when it times out", async () => {
    vi.useFakeTimers();
    try {
      const review = seeded(rec({ comments: [cmt("1")] }));
      let seen: AbortSignal | undefined;
      const store = createCommentsStore(review, () => null, cdeps({
        resolveReviewComment: (_id, _cid, _status, signal) => {
          seen = signal;
          return new Promise(() => {});
        },
      }));
      const pending = store.resolve("1");
      await vi.advanceTimersByTimeAsync(0);
      expect(seen?.aborted).toBe(false);
      await vi.advanceTimersByTimeAsync(WRITE_TIMEOUT_MS);
      expect(await pending).toBe("The server did not answer in time.");
      expect(seen?.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("a hung re-read fails the resync, so the next write is refused instead of stalling the queue", async () => {
    vi.useFakeTimers();
    try {
      let hangReads = false;
      let readSignal: AbortSignal | undefined;
      const review = createReviewStore({
        getComments: (signal) => {
          if (!hangReads) return Promise.resolve(rec({ comments: [cmt("A")] }));
          readSignal = signal;
          return new Promise(() => {});
        },
        getReview: async () => rec(),
        submitReviewOutcome: async () => rec(),
        importLegacyReview: async () => rec(),
        ignoreLegacyReview: async () => ({ legacy: true, ignored: true }),
        removeLegacyReview: async () => ({ removed: true }),
      });
      review.adopt(rec({ comments: [cmt("A")] }));
      const store = createCommentsStore(review, () => null, cdeps({ saveComments: async () => { hangReads = true; throw new Error("lost"); } }));
      expect(await store.remove("A")).toBe("lost");
      const next = store.add(cmt("B"));
      await vi.advanceTimersByTimeAsync(RESYNC_TIMEOUT_MS);
      expect(await next).toMatch(/Could not confirm/);
      expect(readSignal?.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
