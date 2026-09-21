import { describe, it, expect } from "vitest";
import { REVIEW_SCHEMA_VERSION } from "$types";
import type { Comment, ReviewActivity, ReviewActivityType, ReviewFile, ReviewRecord } from "$types";
import { createReviewStore, type ReviewDeps } from "./review.svelte";

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

const legacy = (over: Partial<ReviewFile> = {}): ReviewFile => ({
  meta: { ref: "HEAD", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" },
  viewed: [],
  comments: [],
  ...over,
});

const cmt = (id: string, over: Partial<Comment> = {}): Comment => ({
  id, file: "a.ts", line: 1, lineContent: "x", text: "t", createdAt: "2026-01-01T00:00:00Z", ...over,
});

const act = (id: string, type: ReviewActivityType, actor: ReviewActivity["actor"], summary?: string): ReviewActivity =>
  ({ id, type, actor, createdAt: "2026-01-01T00:00:00Z", summary });

const deps = (over: Partial<ReviewDeps> = {}): ReviewDeps => ({
  getComments: async () => null,
  getReview: async () => rec(),
  submitReviewOutcome: async () => rec(),
  importLegacyReview: async () => rec(),
  ignoreLegacyReview: async () => ({ legacy: true, ignored: true }),
  removeLegacyReview: async () => ({ removed: true }),
  ...over,
});

describe("review store — load", () => {
  it("loads a durable record via getComments", async () => {
    const s = createReviewStore(deps({ getComments: async () => rec({ id: "abc" }) }));
    await s.load();
    expect((s.record as ReviewRecord).id).toBe("abc");
    expect(s.isLegacy).toBe(false);
    expect(s.status).toBe("awaiting_human");
  });

  it("loads a legacy file (no id/status)", async () => {
    const s = createReviewStore(deps({ getComments: async () => legacy() }));
    await s.load();
    expect(s.isLegacy).toBe(true);
    expect(s.status).toBeUndefined();
  });

  it("loads null when neither exists", async () => {
    const s = createReviewStore(deps());
    await s.load();
    expect(s.record).toBeNull();
  });

  it("uses getReview when a reviewId is provided", async () => {
    const s = createReviewStore(deps({ getReview: async (id) => rec({ id }) }), "xyz");
    await s.load();
    expect((s.record as ReviewRecord).id).toBe("xyz");
  });

  it("surfaces the server message on a failed load", async () => {
    const s = createReviewStore(deps({ getComments: async () => { throw new Error("boom"); } }));
    await s.load();
    expect(s.error).toBe("boom");
    expect(s.record).toBeNull();
  });
});

describe("review store — polling", () => {
  it("ignores an older updatedAt response", async () => {
    let n = 0;
    const s = createReviewStore(deps({
      getReview: async () => (n++ === 0 ? rec({ updatedAt: "2026-02-01T00:00:00Z", summary: "new" }) : rec({ updatedAt: "2026-01-01T00:00:00Z", summary: "old" })),
    }), "r1");
    await s.load();
    await s.poll();
    expect((s.record as ReviewRecord).summary).toBe("new");
  });

  it("adopts a newer poll response", async () => {
    let n = 0;
    const s = createReviewStore(deps({
      getReview: async () => (n++ === 0 ? rec({ updatedAt: "2026-01-01T00:00:00Z", summary: "old" }) : rec({ updatedAt: "2026-03-01T00:00:00Z", summary: "fresh" })),
    }), "r1");
    await s.load();
    await s.poll();
    expect((s.record as ReviewRecord).summary).toBe("fresh");
  });

  it("discards an in-flight response after the reviewId changes", async () => {
    let release!: (r: ReviewRecord) => void;
    const gate = new Promise<ReviewRecord>((res) => { release = res; });
    const s = createReviewStore(deps({ getReview: async (id) => (id === "a" ? gate : rec({ id })) }), "a");
    const p = s.load();
    s.setReviewId("b"); // invalidates the in-flight "a" fetch
    release(rec({ id: "a", summary: "stale" }));
    await p;
    expect(s.record).toBeNull();
  });
});

describe("review store — outcome transitions", () => {
  const loaded = async (over: Partial<ReviewDeps> = {}) => {
    const s = createReviewStore(deps({ getComments: async () => rec({ id: "r1" }), ...over }));
    await s.load();
    return s;
  };

  it("returnFeedback adopts a feedback_ready record", async () => {
    const s = await loaded({ submitReviewOutcome: async (_id, kind) => rec({ status: kind === "feedback" ? "feedback_ready" : "approved" }) });
    await s.returnFeedback("done");
    expect(s.status).toBe("feedback_ready");
  });

  it("approve forwards acknowledgeUnresolved and adopts approved", async () => {
    let ack: boolean | undefined;
    const s = await loaded({ submitReviewOutcome: async (_id, _k, _s, a) => { ack = a; return rec({ status: "approved" }); } });
    await s.approve(true);
    expect(ack).toBe(true);
    expect(s.status).toBe("approved");
  });

  it("cancel adopts a cancelled record", async () => {
    const s = await loaded({ submitReviewOutcome: async () => rec({ status: "cancelled" }) });
    await s.cancel("nope");
    expect(s.status).toBe("cancelled");
  });

  it("an invalid transition surfaces the error and leaves the record intact", async () => {
    const s = await loaded({ submitReviewOutcome: async () => { throw new Error("invalid transition"); } });
    await s.approve();
    expect(s.error).toBe("invalid transition");
    expect(s.status).toBe("awaiting_human");
  });

  it("a legacy file supports no outcomes", async () => {
    const s = createReviewStore(deps({ getComments: async () => legacy() }));
    await s.load();
    await s.returnFeedback();
    expect(s.error).toBe("no active review record");
    expect(s.isLegacy).toBe(true);
  });
});

describe("review store — legacy adoption", () => {
  it("imports a legacy file into a record", async () => {
    const s = createReviewStore(deps({ importLegacyReview: async (id) => rec({ id }) }));
    await s.importLegacy("r9");
    expect((s.record as ReviewRecord).id).toBe("r9");
    expect(s.isLegacy).toBe(false);
  });

  it("clears the record on ignore and remove", async () => {
    const s = createReviewStore(deps({ getComments: async () => legacy() }));
    await s.load();
    await s.ignoreLegacy();
    expect(s.record).toBeNull();
    const s2 = createReviewStore(deps({ getComments: async () => legacy() }));
    await s2.load();
    await s2.removeLegacy(true);
    expect(s2.record).toBeNull();
  });
});

describe("review store — activity notice + counts", () => {
  it("accumulates agent activity across polls, newest rereview summary winning, then dismisses", async () => {
    const seq = [
      rec({ updatedAt: "2026-01-01T00:00:00Z", activity: [act("a0", "review_started", "system")] }),
      rec({ updatedAt: "2026-01-02T00:00:00Z", activity: [act("a0", "review_started", "system"), act("a1", "comment_replied", "agent"), act("a2", "comment_addressed", "agent"), act("a3", "rereview_requested", "agent", "recheck")] }),
      rec({ updatedAt: "2026-01-03T00:00:00Z", activity: [act("a0", "review_started", "system"), act("a1", "comment_replied", "agent"), act("a2", "comment_addressed", "agent"), act("a3", "rereview_requested", "agent", "recheck"), act("a4", "comment_replied", "agent")] }),
    ];
    let i = 0;
    const s = createReviewStore(deps({ getReview: async () => seq[Math.min(i++, seq.length - 1)]! }), "r1");
    await s.load(); // seeds a0, no notice
    expect(s.notice).toBeNull();
    await s.poll();
    expect(s.notice).toEqual({ replies: 1, addressed: 1, rereview: true, summary: "recheck" });
    await s.poll();
    expect(s.notice?.replies).toBe(2);
    s.dismiss();
    expect(s.notice).toBeNull();
  });

  it("counts only unresolved comments", async () => {
    const s = createReviewStore(deps({ getComments: async () => rec({ comments: [cmt("1"), cmt("2", { status: "resolved" }), cmt("3", { resolved: true })] }) }));
    await s.load();
    expect(s.unresolvedCount).toBe(1);
  });
});
