import { describe, it, expect } from "vitest";
import type { DiffResult } from "$types";
import { createDiffStore } from "./diff.svelte";

const diffA: DiffResult = { ref: "a", files: [{ path: "a.ts", oldPath: null, changeType: "modified", additions: 1, deletions: 0, hunks: [] }] };
const diffB: DiffResult = { ref: "b", meta: { repo: "o/r", mode: "branch", source: "b", target: "main" }, files: [] };

describe("diff store", () => {
  it("initial load goes loading then ready", async () => {
    const store = createDiffStore({ getDiff: async () => diffA });
    const p = store.load();
    expect(store.state.status).toBe("loading");
    await p;
    expect(store.state).toEqual({ status: "ready", diff: diffA });
    expect(store.files).toEqual(diffA.files);
    expect(store.ref).toBe("a");
  });

  it("initial load failure surfaces the server message", async () => {
    const store = createDiffStore({ getDiff: async () => { throw new Error("git failed"); } });
    await store.load();
    expect(store.state).toEqual({ status: "error", message: "git failed" });
  });

  it("refresh replaces the diff", async () => {
    let current = diffA;
    const store = createDiffStore({ getDiff: async () => current });
    await store.load();
    current = diffB;
    await store.refresh();
    expect(store.state).toEqual({ status: "ready", diff: diffB });
    expect(store.meta).toEqual(diffB.meta);
  });

  it("refresh error keeps the previous diff and flags the failure", async () => {
    let fail = false;
    const store = createDiffStore({ getDiff: async () => { if (fail) throw new Error("nope"); return diffA; } });
    await store.load();
    fail = true;
    await store.refresh();
    expect(store.state).toEqual({ status: "ready", diff: diffA });
    expect(store.refreshFailed).toBe(true);
  });

  it("refresh error before any good diff surfaces the error", async () => {
    const store = createDiffStore({ getDiff: async () => { throw new Error("cold"); } });
    await store.refresh();
    expect(store.state).toEqual({ status: "error", message: "cold" });
  });
});
