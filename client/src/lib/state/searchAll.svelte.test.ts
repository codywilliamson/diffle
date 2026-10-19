import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SearchHit, SearchResponse } from "$types";
import { SEARCH_DEBOUNCE_MS, createSearchAllStore } from "./searchAll.svelte";

const hit = (path: string, line: number): SearchHit => ({ path, side: "new", line, preview: "x", ranges: [[0, 1]] });
const ok = (...hits: SearchHit[]): SearchResponse => ({ results: hits, truncated: false });

type Fetch = (query: string, regex: boolean, signal?: AbortSignal) => Promise<SearchResponse>;

function setup(fetchHits: Fetch) {
  const jump = vi.fn();
  const search = createSearchAllStore({ jump, fetchHits });
  return { search, jump };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("debounce and abort", () => {
  it("waits for the debounce, and only the last keystroke fetches", async () => {
    const fetchHits = vi.fn<Fetch>(async () => ok(hit("a.ts", 1)));
    const { search } = setup(fetchHits);
    search.setQuery("a");
    search.setQuery("al");
    search.setQuery("alp");
    await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS - 1);
    expect(fetchHits).not.toHaveBeenCalled();
    expect(search.status).toBe("loading");
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchHits).toHaveBeenCalledTimes(1);
    expect(fetchHits.mock.calls[0]?.slice(0, 2)).toEqual(["alp", false]);
    expect(search.status).toBe("ready");
    expect(search.hits).toHaveLength(1);
  });

  it("aborts the in-flight fetch when a newer query starts, and drops its answer", async () => {
    const signals: AbortSignal[] = [];
    const resolvers: ((r: SearchResponse) => void)[] = [];
    const fetchHits = vi.fn<Fetch>((_q, _r, signal) => {
      signals.push(signal as AbortSignal);
      return new Promise((resolve) => resolvers.push(resolve));
    });
    const { search } = setup(fetchHits);
    search.setQuery("one");
    await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);
    search.setQuery("two");
    expect(signals[0]?.aborted).toBe(true);
    await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);
    resolvers[1]?.(ok(hit("b.ts", 2)));
    resolvers[0]?.(ok(hit("stale.ts", 9)));
    await vi.advanceTimersByTimeAsync(0);
    expect(search.hits.map((h) => h.path)).toEqual(["b.ts"]);
  });

  it("sends regex=true after toggling and clears on an empty query", async () => {
    const fetchHits = vi.fn<Fetch>(async () => ok(hit("a.ts", 1)));
    const { search } = setup(fetchHits);
    search.setQuery("a.");
    search.toggleRegex();
    await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);
    expect(fetchHits.mock.calls[0]?.slice(0, 2)).toEqual(["a.", true]);
    search.setQuery("  ");
    expect(search.status).toBe("idle");
    expect(search.hits).toEqual([]);
  });

  it("shows the server's message on a failure", async () => {
    const { search } = setup(async () => {
      throw new Error("invalid regex: unterminated group");
    });
    search.setQuery("(");
    await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);
    expect(search.status).toBe("error");
    expect(search.error).toBe("invalid regex: unterminated group");
  });

  it("closing cancels a pending fetch, and reopening runs it", async () => {
    const fetchHits = vi.fn<Fetch>(async () => ok());
    const { search } = setup(fetchHits);
    search.start();
    search.setQuery("zz");
    search.close();
    await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS * 2);
    expect(fetchHits).not.toHaveBeenCalled();
    search.start();
    await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);
    expect(fetchHits).toHaveBeenCalledTimes(1);
  });
});

describe("keyboard selection", () => {
  async function loaded() {
    const ctx = setup(async () => ok(hit("a.ts", 1), hit("a.ts", 5), hit("b.ts", 2)));
    ctx.search.setQuery("x");
    await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);
    return ctx;
  }

  it("moves within bounds and activates the selected hit", async () => {
    const { search, jump } = await loaded();
    search.move(-1);
    expect(search.selected).toBe(0);
    search.move(1);
    search.move(1);
    search.move(1);
    expect(search.selected).toBe(2);
    search.activate();
    expect(jump).toHaveBeenCalledWith(hit("b.ts", 2));
  });

  it("activates a clicked row", async () => {
    const { search, jump } = await loaded();
    search.activate(1);
    expect(search.selected).toBe(1);
    expect(jump).toHaveBeenCalledWith(hit("a.ts", 5));
  });
});
