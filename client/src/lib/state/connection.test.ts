import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CONFIRM_DELAY_MS, RECOVERY_INTERVAL_MS, createConnectionStore, type ProbeResult } from "./connection.svelte";
import { onServerLink, reportReachable, reportUnreachable, setMutationBlock } from "$lib/api/serverLink";
import { apiGet, apiPost } from "$lib/api/http";
import { createAppState } from "./context";

const DOWN: ProbeResult = { up: false };
const up = (reviewId: string | null): ProbeResult => ({ up: true, reviewId });

function setup(results: ProbeResult[], pageReviewId: string | null = "A") {
  const probe = vi.fn(async () => results.shift() ?? DOWN);
  const onRecover = vi.fn();
  return { store: createConnectionStore({ probe, pageReviewId: () => pageReviewId ?? undefined, onRecover }), probe, onRecover };
}

describe("connection store", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("stays online for a single blip that the probe disproves", async () => {
    const { store, probe, onRecover } = setup([up("A")]);
    store.unreachable();
    expect(store.state).toBe("suspect");
    await vi.advanceTimersByTimeAsync(CONFIRM_DELAY_MS);
    expect(probe).toHaveBeenCalledTimes(1);
    expect(store.state).toBe("online");
    expect(onRecover).not.toHaveBeenCalled();
  });

  it("only probes once for a burst of failures", async () => {
    const { store, probe } = setup([up("A")]);
    store.unreachable();
    store.unreachable();
    store.unreachable();
    await vi.advanceTimersByTimeAsync(CONFIRM_DELAY_MS);
    expect(probe).toHaveBeenCalledTimes(1);
  });

  it("goes gone when the confirming probe fails, with a reason for disabled actions", async () => {
    const { store } = setup([DOWN]);
    expect(store.blockedReason).toBeNull();
    store.unreachable();
    await vi.advanceTimersByTimeAsync(CONFIRM_DELAY_MS);
    expect(store.gone).toBe(true);
    expect(store.blockedReason).toMatch(/server is gone/i);
  });

  it("recovers on a recovery probe that serves the same review", async () => {
    const { store, probe, onRecover } = setup([DOWN, DOWN, up("A")]);
    store.unreachable();
    await vi.advanceTimersByTimeAsync(CONFIRM_DELAY_MS);
    await vi.advanceTimersByTimeAsync(RECOVERY_INTERVAL_MS);
    expect(store.gone).toBe(true);
    await vi.advanceTimersByTimeAsync(RECOVERY_INTERVAL_MS);
    expect(probe).toHaveBeenCalledTimes(3);
    expect(store.state).toBe("online");
    expect(onRecover).toHaveBeenCalledTimes(1);
  });

  it("a different review on the same port stays blocked and never recovers", async () => {
    const { store, onRecover } = setup([DOWN, up("B"), up("B")]);
    store.unreachable();
    await vi.advanceTimersByTimeAsync(CONFIRM_DELAY_MS);
    await vi.advanceTimersByTimeAsync(RECOVERY_INTERVAL_MS);
    expect(store.mismatch).toBe(true);
    expect(store.blockedReason).toMatch(/different review/i);
    expect(store.reloadUrl).toContain("review=B");
    await vi.advanceTimersByTimeAsync(RECOVERY_INTERVAL_MS);
    expect(store.mismatch).toBe(true);
    expect(onRecover).not.toHaveBeenCalled();
  });

  it("a server with no durable review only matches a page with none", async () => {
    const same = setup([DOWN, up(null)], null);
    same.store.unreachable();
    await vi.advanceTimersByTimeAsync(CONFIRM_DELAY_MS + RECOVERY_INTERVAL_MS);
    expect(same.store.state).toBe("online");
    const other = setup([DOWN, up(null)], "A");
    other.store.unreachable();
    await vi.advanceTimersByTimeAsync(CONFIRM_DELAY_MS + RECOVERY_INTERVAL_MS);
    expect(other.store.mismatch).toBe(true);
  });

  it("an answering request while gone triggers an identity probe, not a recovery", async () => {
    const { store, probe, onRecover } = setup([DOWN, up("B")]);
    store.unreachable();
    await vi.advanceTimersByTimeAsync(CONFIRM_DELAY_MS);
    store.reachable();
    await vi.advanceTimersByTimeAsync(0);
    expect(probe).toHaveBeenCalledTimes(2);
    expect(store.mismatch).toBe(true);
    expect(onRecover).not.toHaveBeenCalled();
  });

  it("an answer while only suspect is confirmed by a probe without a recover reload", async () => {
    const { store, probe, onRecover } = setup([up("A")]);
    store.unreachable();
    store.reachable();
    await vi.advanceTimersByTimeAsync(CONFIRM_DELAY_MS * 2);
    expect(probe).toHaveBeenCalledTimes(1);
    expect(store.state).toBe("online");
    expect(onRecover).not.toHaveBeenCalled();
  });

  it("verify blocks writes until the probe confirms the same review", async () => {
    const { store, onRecover } = setup([up("A")]);
    store.verify();
    expect(store.blockedReason).toMatch(/checking/i);
    await vi.advanceTimersByTimeAsync(0);
    expect(store.state).toBe("online");
    expect(store.blockedReason).toBeNull();
    expect(onRecover).toHaveBeenCalledTimes(1);
  });

  it("verify against a different review ends blocked as a mismatch", async () => {
    const { store, onRecover } = setup([up("B")]);
    store.verify();
    await vi.advanceTimersByTimeAsync(0);
    expect(store.mismatch).toBe(true);
    expect(onRecover).not.toHaveBeenCalled();
  });

  it("verify with the server down ends as gone", async () => {
    const { store } = setup([DOWN]);
    store.verify();
    await vi.advanceTimersByTimeAsync(0);
    expect(store.gone).toBe(true);
  });

  it("a probe superseded by a newer one is ignored", async () => {
    let release: (r: ProbeResult) => void = () => {};
    const slow = new Promise<ProbeResult>((resolve) => (release = resolve));
    const results = [slow, Promise.resolve(up("A"))];
    const onRecover = vi.fn();
    const store = createConnectionStore({ probe: () => results.shift() ?? Promise.resolve(DOWN), pageReviewId: () => "A", onRecover });
    store.unreachable();
    await vi.advanceTimersByTimeAsync(CONFIRM_DELAY_MS); // first probe hangs
    store.reachable(); // second probe resolves up/same
    await vi.advanceTimersByTimeAsync(0);
    expect(store.state).toBe("online");
    release(DOWN); // the stale probe must not flip it to gone
    await vi.advanceTimersByTimeAsync(0);
    expect(store.state).toBe("online");
  });

  it("a probe resolving after dispose does nothing", async () => {
    let release: (r: ProbeResult) => void = () => {};
    const store = createConnectionStore({ probe: () => new Promise((resolve) => (release = resolve)), pageReviewId: () => "A", onRecover: vi.fn() });
    store.unreachable();
    await vi.advanceTimersByTimeAsync(CONFIRM_DELAY_MS);
    store.dispose();
    release(DOWN);
    await vi.advanceTimersByTimeAsync(RECOVERY_INTERVAL_MS * 2);
    expect(store.state).toBe("suspect");
  });
});

describe("fetch layer", () => {
  const seen: string[] = [];
  let off: () => void;
  beforeEach(() => {
    seen.length = 0;
    off = onServerLink((e) => seen.push(e));
  });
  afterEach(() => {
    off();
    setMutationBlock(() => null);
    vi.unstubAllGlobals();
  });

  it("a network error reports unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(apiGet("/api/x")).rejects.toThrow("Failed to fetch");
    expect(seen).toEqual(["unreachable"]);
  });

  it("an HTTP error still proves the server is there", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 500 })));
    await expect(apiGet("/api/x")).rejects.toThrow("request failed (500)");
    expect(seen).toEqual(["reachable"]);
  });

  it("our own abort is not a failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("aborted", "AbortError")));
    await expect(apiGet("/api/x")).rejects.toThrow();
    expect(seen).toEqual([]);
  });

  it("report helpers reach listeners", () => {
    reportUnreachable();
    reportReachable();
    expect(seen).toEqual(["unreachable", "reachable"]);
  });

  it("every POST is refused with the reason while writes are blocked, GETs are not", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    setMutationBlock(() => "The server is gone. Restart it to continue.");
    await expect(apiPost("/api/review/reply", {})).rejects.toThrow("server is gone");
    await expect(apiPost("/api/viewed", {})).rejects.toThrow("server is gone");
    expect(fetchMock).not.toHaveBeenCalled();
    await apiGet("/api/x");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    setMutationBlock(() => null);
    await apiPost("/api/viewed", {});
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("recovery wiring", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("reloads the record through the guarded poll and leaves the diff alone", async () => {
    let up = false;
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        urls.push(url);
        if (!up) throw new TypeError("Failed to fetch");
        return new Response(JSON.stringify({ id: "A", comments: [], viewed: [], activity: [], status: "awaiting_human", updatedAt: "2026-01-01T00:00:00Z" }), { status: 200 });
      }),
    );
    const app = createAppState("A");
    app.connection.unreachable();
    await vi.advanceTimersByTimeAsync(CONFIRM_DELAY_MS);
    expect(app.connection.gone).toBe(true);
    urls.length = 0;
    up = true;
    await vi.advanceTimersByTimeAsync(RECOVERY_INTERVAL_MS);
    expect(app.connection.state).toBe("online");
    expect(urls).toContain("/api/review?id=A");
    expect(urls.some((u) => u.startsWith("/api/diff"))).toBe(false);
    app.connection.dispose();
  });
});
