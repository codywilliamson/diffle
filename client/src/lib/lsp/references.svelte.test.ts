import { describe, expect, it, vi } from "vitest";
import type { LspReferenceFile, LspReferencesResponse } from "$types";
import { capGroups, createReferencesStore } from "./references.svelte";

const range = (line: number) => ({ start: { line, character: 2 }, end: { line, character: 6 } });
const ref = (line: number) => ({ range: range(line), contextStartLine: line - 1, contextLines: ["a", "b", "c"] });
const file = (path: string, lines: number[], changed = false): LspReferenceFile => ({
  uri: `file:///r/${path}`, path, absolutePath: `/r/${path}`, inRepo: true, inDiff: changed, changed, references: lines.map(ref),
});

function setup(response: LspReferencesResponse | Error, cap?: number) {
  const jump = vi.fn();
  const onError = vi.fn();
  const request = vi.fn(() => (response instanceof Error ? Promise.reject(response) : Promise.resolve(response)));
  const store = createReferencesStore({ request, jump, onError, cap });
  return { store, jump, onError, request };
}

const at = { path: "a.ts", side: "new" as const, line: 1, character: 0 };

describe("capGroups", () => {
  it("cuts whole entries across files and drops files left empty", () => {
    const { groups, shown } = capGroups([file("a.ts", [1, 2, 3]), file("b.ts", [4, 5]), file("c.ts", [6])], 4);
    expect(shown).toBe(4);
    expect(groups.map((g) => [g.file.path, g.items.map((i) => i.index)])).toEqual([["a.ts", [0, 1, 2]], ["b.ts", [3]]]);
  });
});

describe("references store", () => {
  it("loads, numbers the entries across files and reports a server-side cut", async () => {
    const { store } = setup({ files: [file("a.ts", [1, 2], true), file("b.ts", [9])], total: 40, truncated: true });
    await store.start(at, "greet");
    expect(store.open).toBe(true);
    expect(store.status).toBe("ready");
    expect(store.groups.map((g) => g.items.length)).toEqual([2, 1]);
    expect([store.shown, store.total, store.truncated]).toEqual([3, 40, true]);
  });

  it("applies the client cap and says how many were hidden", async () => {
    const { store } = setup({ files: [file("a.ts", [1, 2, 3, 4, 5])], total: 5, truncated: false }, 2);
    await store.start(at, "x");
    expect([store.shown, store.total, store.truncated]).toEqual([2, 5, true]);
  });

  it("moves within bounds and jumps to the selected entry's range", async () => {
    const { store, jump } = setup({ files: [file("a.ts", [10, 20], true), file("b.ts", [30])], total: 3, truncated: false });
    await store.start(at, "x");
    store.move(-1);
    expect(store.selected).toBe(0);
    store.move(5);
    expect(store.selected).toBe(2);
    store.activate();
    expect(jump).toHaveBeenCalledWith({ path: "b.ts", absolutePath: "/r/b.ts", uri: "file:///r/b.ts", inRepo: true, line: 30, character: 2 });
    store.activate(0);
    expect(jump.mock.calls[1]![0].line).toBe(10);
    expect(store.selected).toBe(0);
    expect(store.open).toBe(true);
  });

  it("closes itself and reports a failed request", async () => {
    const error = new Error("down");
    const { store, onError } = setup(error);
    await store.start(at, "x");
    expect(store.open).toBe(false);
    expect(onError).toHaveBeenCalledWith(error);
  });

  it("close reports whether it was open and aborts a request in flight", async () => {
    let signal: AbortSignal | undefined;
    const store = createReferencesStore({
      request: (_r, s) => { signal = s; return new Promise(() => {}); },
      jump: vi.fn(),
      onError: vi.fn(),
    });
    void store.start(at, "x");
    expect(store.status).toBe("loading");
    expect(store.close()).toBe(true);
    expect(signal?.aborted).toBe(true);
    expect(store.close()).toBe(false);
  });
});
