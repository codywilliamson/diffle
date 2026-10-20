import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LspSymbol, LspWorkspaceSymbol } from "$types";
import { createSymbolsStore, SYMBOL_DEBOUNCE_MS } from "./symbols.svelte";
import { documentRows, visibleRows } from "./symbolRows";

const range = (line: number) => ({ start: { line, character: 0 }, end: { line, character: 4 } });
const sym = (name: string, kind: string, line: number, changed = false, children: LspSymbol[] = []): LspSymbol => ({
  name, kind, range: range(line), selectionRange: { start: { line, character: 6 }, end: { line, character: 9 } }, changed, children,
});
const OUTLINE = [sym("Greeter", "class", 1, true, [sym("constructor", "constructor", 2), sym("greet", "method", 4, true), sym("shout", "method", 8)])];

describe("documentRows", () => {
  it("flattens the outline with nesting depth, container and changed marks", () => {
    const rows = documentRows("src/greeter.ts", OUTLINE);
    expect(rows.map((r) => [r.name, r.depth, r.container, r.changed])).toEqual([
      ["Greeter", 0, undefined, true],
      ["constructor", 1, "Greeter", false],
      ["greet", 1, "Greeter", true],
      ["shout", 1, "Greeter", false],
    ]);
    expect(rows[2]!.target).toMatchObject({ path: "src/greeter.ts", inRepo: true, line: 4, character: 6 });
  });
});

describe("visibleRows", () => {
  const rows = documentRows("a.ts", OUTLINE);

  it("keeps the outline when the query is empty", () => {
    expect(visibleRows(rows, "  ")).toBe(rows);
  });

  it("filters by word-start prefix, flat, best first, with match indices", () => {
    const shown = visibleRows(rows, "gre");
    expect(shown.map((r) => r.name)).toEqual(["greet", "Greeter"]); // equal prefix match: shorter first
    expect(shown[1]!.depth).toBe(0);
    expect(shown[0]!.indices).toEqual([0, 1, 2]);
  });

  it("can keep non-matching rows after the matches", () => {
    expect(visibleRows(rows, "shout", true).map((r) => r.name)).toEqual(["shout", "Greeter", "constructor", "greet"]);
  });
});

describe("symbols store", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function setup() {
    const jump = vi.fn();
    const onError = vi.fn();
    const workspaceCalls: { query: string; signal: AbortSignal }[] = [];
    const hang = { on: false };
    const store = createSymbolsStore({
      document: async (path) => ({ path, symbols: OUTLINE }),
      workspace: async (query, signal) => {
        workspaceCalls.push({ query, signal });
        if (query.length >= 1 && hang.on) await new Promise(() => {});
        const symbols: LspWorkspaceSymbol[] = [{
          name: `found-${query}`, kind: "function", uri: "file:///r/x.ts", path: "x.ts", absolutePath: "/r/x.ts", inRepo: true, inDiff: false, range: range(3),
        }];
        return { symbols, total: 1, truncated: false };
      },
      jump,
      onError,
    });
    return { store, jump, onError, workspaceCalls, hang };
  }

  it("opens the current file's outline and jumps on Enter, closing the picker", async () => {
    const { store, jump } = setup();
    await store.openDocument("src/greeter.ts");
    expect(store.status).toBe("ready");
    expect(store.rows).toHaveLength(4);
    store.setQuery("sho");
    expect(store.rows.map((r) => r.name)).toEqual(["shout"]);
    store.activate();
    expect(jump).toHaveBeenCalledWith(expect.objectContaining({ path: "src/greeter.ts", line: 8 }));
    expect(store.open).toBe(false);
  });

  it("debounces workspace queries into one request for the last text", async () => {
    const { store, workspaceCalls } = setup();
    store.openWorkspace();
    await vi.advanceTimersByTimeAsync(0);
    expect(workspaceCalls.map((c) => c.query)).toEqual([""]);
    store.setQuery("g");
    await vi.advanceTimersByTimeAsync(SYMBOL_DEBOUNCE_MS - 50);
    store.setQuery("gr");
    await vi.advanceTimersByTimeAsync(SYMBOL_DEBOUNCE_MS - 1);
    expect(workspaceCalls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(workspaceCalls.map((c) => c.query)).toEqual(["", "gr"]);
    expect(store.status).toBe("ready");
  });

  it("aborts the workspace request in flight when the query changes or the picker closes", async () => {
    const { store, workspaceCalls, hang } = setup();
    store.openWorkspace();
    await vi.advanceTimersByTimeAsync(0);
    hang.on = true; // queries after the first never answer, so they are still in flight
    store.setQuery("a");
    await vi.advanceTimersByTimeAsync(SYMBOL_DEBOUNCE_MS);
    store.setQuery("ab");
    expect(workspaceCalls[1]!.signal.aborted).toBe(true);
    await vi.advanceTimersByTimeAsync(SYMBOL_DEBOUNCE_MS);
    store.close();
    expect(workspaceCalls[2]!.signal.aborted).toBe(true);
  });

  it("hands the real workspace error, not the query, to onError", async () => {
    const onError = vi.fn();
    const failure = new Error("typescript server is missing");
    const store = createSymbolsStore({ document: async (path) => ({ path, symbols: [] }), workspace: () => Promise.reject(failure), jump: vi.fn(), onError });
    store.openWorkspace();
    await vi.advanceTimersByTimeAsync(0);
    expect(onError).toHaveBeenCalledWith(failure);
  });

  it("closes and reports when the outline cannot load", async () => {
    const onError = vi.fn();
    const store = createSymbolsStore({ document: () => Promise.reject(new Error("no server")), workspace: async () => ({ symbols: [], total: 0, truncated: false }), jump: vi.fn(), onError });
    await store.openDocument("a.ts");
    expect(store.open).toBe(false);
    expect(onError).toHaveBeenCalled();
  });
});
