import { describe, it, expect, vi, afterEach } from "vitest";
import type { ReviewRecord } from "$types";
import { getComments, saveComments, saveViewed } from "./comments";
import { getReview, submitReviewOutcome, resolveReviewComment, replyToReviewComment, importLegacyReview, removeLegacyReview, detectLegacyReview } from "./review";
import { compile, getFile, getState, saveState, getUpdate, rawUrl } from "./meta";

const record = { id: "r1", status: "awaiting_human", comments: [], viewed: [], activity: [] } as unknown as ReviewRecord;

function ok(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
}
function stub(response: Response) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
function lastBody(fetchMock: ReturnType<typeof vi.fn>) {
  return JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
}

afterEach(() => vi.unstubAllGlobals());

describe("comments adapters", () => {
  it("returns the record when the server has one", async () => {
    stub(ok(record));
    expect(await getComments()).toEqual(record);
  });

  it("normalizes the empty {} response to null", async () => {
    stub(ok({}));
    expect(await getComments()).toBeNull();
  });

  it("saveComments posts the comments array", async () => {
    const fetchMock = stub(ok(record));
    await saveComments([{ id: "c1" } as never]);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/comments");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "POST" });
    expect(lastBody(fetchMock)).toEqual({ comments: [{ id: "c1" }] });
  });

  it("saveViewed posts the viewed array", async () => {
    const fetchMock = stub(ok(record));
    await saveViewed(["a.ts"]);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/viewed");
    expect(lastBody(fetchMock)).toEqual({ viewed: ["a.ts"] });
  });
});

describe("review adapters", () => {
  it("getReview encodes the id in the query", async () => {
    const fetchMock = stub(ok(record));
    await getReview("a b/c");
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/review?id=a%20b%2Fc");
  });

  it("submitReviewOutcome sends id, outcome, summary, and ack", async () => {
    const fetchMock = stub(ok(record));
    await submitReviewOutcome("r1", "approved", "lgtm", true);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/review/outcome");
    expect(lastBody(fetchMock)).toEqual({ id: "r1", outcome: "approved", summary: "lgtm", acknowledgeUnresolved: true });
  });

  it("resolveReviewComment posts the reviewer status", async () => {
    const fetchMock = stub(ok(record));
    await resolveReviewComment("r1", "c2", "resolved");
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/review/status");
    expect(lastBody(fetchMock)).toEqual({ id: "r1", commentId: "c2", status: "resolved" });
  });

  it("replyToReviewComment posts id, commentId, and text", async () => {
    const fetchMock = stub(ok(record));
    await replyToReviewComment("r1", "c2", "done");
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/review/reply");
    expect(lastBody(fetchMock)).toEqual({ id: "r1", commentId: "c2", text: "done" });
  });

  it("legacy import/remove/detect hit the legacy endpoint", async () => {
    let fetchMock = stub(ok(record));
    await importLegacyReview("r9");
    expect(lastBody(fetchMock)).toEqual({ action: "import", id: "r9" });

    vi.unstubAllGlobals();
    fetchMock = stub(ok({ removed: true }));
    await removeLegacyReview(true);
    expect(lastBody(fetchMock)).toEqual({ action: "remove", confirm: true });

    vi.unstubAllGlobals();
    fetchMock = stub(ok({ present: true }));
    expect(await detectLegacyReview()).toEqual({ present: true });
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/review/legacy");
  });

  it("surfaces the server error text on a failed transition", async () => {
    stub(new Response(JSON.stringify({ error: "cannot approve a cancelled review" }), { status: 409 }));
    await expect(submitReviewOutcome("r1", "approved")).rejects.toThrow("cannot approve a cancelled review");
  });
});

describe("meta adapters", () => {
  it("compile appends a trimmed summary query only when present", async () => {
    let fetchMock = stub(ok({ prompt: "p" }));
    await compile("  ");
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/compile");

    vi.unstubAllGlobals();
    fetchMock = stub(ok({ prompt: "p" }));
    await compile("recheck");
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/compile?summary=recheck");
  });

  it("getFile encodes the path", async () => {
    const fetchMock = stub(ok({ path: "a b.ts", content: "x" }));
    await getFile("a b.ts");
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/file?path=a%20b.ts");
  });

  it("state round-trips seenVersion", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(ok({ seenVersion: "1.0.0" })).mockResolvedValueOnce(ok({ seenVersion: "2.0.0" }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await getState()).toEqual({ seenVersion: "1.0.0" });
    await saveState({ seenVersion: "2.0.0" });
    expect(JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string)).toEqual({ seenVersion: "2.0.0" });
  });

  it("getUpdate reads the update status", async () => {
    stub(ok({ behind: false, current: "1", latest: "1", repoPath: "/x" }));
    expect((await getUpdate()).behind).toBe(false);
  });

  it("rawUrl builds an encoded /api/raw url without fetching", () => {
    expect(rawUrl("dir/a b.png")).toBe("/api/raw?path=dir%2Fa%20b.png");
  });
});
