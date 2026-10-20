import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CONFIRM_DELAY_MS, RECOVERY_INTERVAL_MS, createConnectionStore } from "./connection.svelte";
import { onServerLink, reportReachable, reportUnreachable } from "$lib/api/serverLink";
import { apiGet } from "$lib/api/http";

function setup(probeResults: boolean[]) {
  const probe = vi.fn(async () => probeResults.shift() ?? false);
  const onRecover = vi.fn();
  return { store: createConnectionStore({ probe, onRecover }), probe, onRecover };
}

describe("connection store", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("stays online for a single blip that the probe disproves", async () => {
    const { store, probe, onRecover } = setup([true]);
    store.unreachable();
    expect(store.state).toBe("suspect");
    expect(store.gone).toBe(false);
    await vi.advanceTimersByTimeAsync(CONFIRM_DELAY_MS);
    expect(probe).toHaveBeenCalledTimes(1);
    expect(store.state).toBe("online");
    expect(onRecover).not.toHaveBeenCalled();
  });

  it("only probes once for a burst of failures", async () => {
    const { store, probe } = setup([true]);
    store.unreachable();
    store.unreachable();
    store.unreachable();
    await vi.advanceTimersByTimeAsync(CONFIRM_DELAY_MS);
    expect(probe).toHaveBeenCalledTimes(1);
  });

  it("goes gone when the confirming probe fails, with a reason for disabled actions", async () => {
    const { store } = setup([false]);
    expect(store.blockedReason).toBeNull();
    store.unreachable();
    await vi.advanceTimersByTimeAsync(CONFIRM_DELAY_MS);
    expect(store.gone).toBe(true);
    expect(store.blockedReason).toMatch(/server is gone/i);
  });

  it("recovers on its own when a recovery probe succeeds", async () => {
    const { store, probe, onRecover } = setup([false, false, true]);
    store.unreachable();
    await vi.advanceTimersByTimeAsync(CONFIRM_DELAY_MS);
    expect(store.gone).toBe(true);
    await vi.advanceTimersByTimeAsync(RECOVERY_INTERVAL_MS);
    expect(store.gone).toBe(true);
    await vi.advanceTimersByTimeAsync(RECOVERY_INTERVAL_MS);
    expect(probe).toHaveBeenCalledTimes(3);
    expect(store.state).toBe("online");
    expect(onRecover).toHaveBeenCalledTimes(1);
  });

  it("recovers at once when any request gets an answer while gone", async () => {
    const { store, onRecover } = setup([false]);
    store.unreachable();
    await vi.advanceTimersByTimeAsync(CONFIRM_DELAY_MS);
    store.reachable();
    expect(store.state).toBe("online");
    expect(onRecover).toHaveBeenCalledTimes(1);
  });

  it("an answer while only suspect cancels the check without a recover reload", async () => {
    const { store, probe, onRecover } = setup([false]);
    store.unreachable();
    store.reachable();
    await vi.advanceTimersByTimeAsync(CONFIRM_DELAY_MS * 2);
    expect(probe).not.toHaveBeenCalled();
    expect(store.state).toBe("online");
    expect(onRecover).not.toHaveBeenCalled();
  });
});

describe("fetch layer signals", () => {
  const seen: string[] = [];
  let off: () => void;
  beforeEach(() => {
    seen.length = 0;
    off = onServerLink((e) => seen.push(e));
  });
  afterEach(() => {
    off();
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
});
