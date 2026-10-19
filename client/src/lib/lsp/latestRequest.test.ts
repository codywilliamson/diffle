import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLatestRequest } from "./latestRequest";

interface Pending {
  arg: string;
  signal: AbortSignal;
  resolve: (value: string) => void;
}

function harness(delayMs = 100) {
  const pending: Pending[] = [];
  const results: string[] = [];
  const errors: unknown[] = [];
  const request = createLatestRequest<string, string>({
    delayMs,
    run: (arg, signal) => new Promise((resolve) => pending.push({ arg, signal, resolve })),
    onResult: (_arg, value) => results.push(value),
    onError: (_arg, error) => errors.push(error),
  });
  return { request, pending, results, errors };
}

describe("createLatestRequest", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("waits out the delay and coalesces a burst into one request", () => {
    const { request, pending } = harness();
    request.schedule("a");
    vi.advanceTimersByTime(60);
    request.schedule("b");
    vi.advanceTimersByTime(60);
    expect(pending).toHaveLength(0);
    vi.advanceTimersByTime(40);
    expect(pending.map((p) => p.arg)).toEqual(["b"]);
  });

  it("aborts the request in flight when a newer target is scheduled", () => {
    const { request, pending } = harness();
    request.now("a");
    expect(pending[0]!.signal.aborted).toBe(false);
    request.schedule("b");
    expect(pending[0]!.signal.aborted).toBe(true);
  });

  it("drops a late answer to a superseded request", async () => {
    const { request, pending, results } = harness();
    request.now("a");
    request.now("b");
    pending[0]!.resolve("answer a");
    pending[1]!.resolve("answer b");
    await vi.runAllTimersAsync();
    expect(results).toEqual(["answer b"]);
  });

  it("cancel aborts and silences the request", async () => {
    const { request, pending, results } = harness();
    request.now("a");
    request.cancel();
    pending[0]!.resolve("late");
    await vi.runAllTimersAsync();
    expect(pending[0]!.signal.aborted).toBe(true);
    expect(results).toEqual([]);
  });

  it("cancel also clears a pending timer", () => {
    const { request, pending } = harness();
    request.schedule("a");
    request.cancel();
    vi.advanceTimersByTime(500);
    expect(pending).toHaveLength(0);
  });

  it("reports failures of the live request but not aborts", async () => {
    const errors: unknown[] = [];
    const request = createLatestRequest<string, string>({
      delayMs: 0,
      run: (arg) => (arg === "a" ? Promise.reject(new DOMException("x", "AbortError")) : Promise.reject(new Error("boom"))),
      onResult: () => {},
      onError: (_arg, error) => errors.push(error),
    });
    request.now("a");
    await vi.runAllTimersAsync();
    expect(errors).toEqual([]);
    request.now("b");
    await vi.runAllTimersAsync();
    expect(errors).toHaveLength(1);
  });
});
