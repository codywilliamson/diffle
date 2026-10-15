import { describe, it, expect } from "vitest";
import type { Comment } from "$types";
import { createThreadsStore } from "./threads.svelte";
import { PREFS_PREFIX, type StorageLike } from "./prefs-storage";

function fakeStorage(): StorageLike & { data: Record<string, string> } {
  const data: Record<string, string> = {};
  return { data, getItem: (key) => data[key] ?? null, setItem: (key, value) => void (data[key] = value) };
}

const comment = (id: string, extra: Partial<Comment> = {}): Comment =>
  ({ id, file: "a.ts", line: 3, lineContent: "+x", text: "t", createdAt: "2026-01-01T00:00:00.000Z", ...extra });

describe("threads store", () => {
  it("collapses resolved threads by default and keeps open ones expanded", () => {
    const threads = createThreadsStore("r1", fakeStorage());
    expect(threads.isCollapsed([comment("a")])).toBe(false);
    expect(threads.isCollapsed([comment("a", { status: "resolved" })])).toBe(true);
    expect(threads.isCollapsed([comment("a", { resolved: true }), comment("b")])).toBe(false);
    expect(threads.isCollapsed([])).toBe(false);
  });

  it("lets the reader toggle a thread", () => {
    const threads = createThreadsStore("r1", fakeStorage());
    const open = [comment("a")];
    threads.toggle(open);
    expect(threads.isCollapsed(open)).toBe(true);
    threads.setCollapsed(open, false);
    expect(threads.isCollapsed(open)).toBe(false);
  });

  it("collapses a thread once it gets resolved, whatever the reader chose while it was open", () => {
    const threads = createThreadsStore("r1", fakeStorage());
    threads.setCollapsed([comment("a")], false);
    expect(threads.isCollapsed([comment("a", { status: "resolved" })])).toBe(true);
  });

  it("keeps an override on a resolved thread out of its open state", () => {
    const threads = createThreadsStore("r1", fakeStorage());
    threads.setCollapsed([comment("a", { status: "resolved" })], false);
    expect(threads.isCollapsed([comment("a", { status: "resolved" })])).toBe(false);
    threads.setCollapsed([comment("b")], true);
    expect(threads.isCollapsed([comment("a")])).toBe(false);
    expect(threads.isCollapsed([comment("b")])).toBe(true);
  });

  it("persists per review and survives broken storage", () => {
    const storage = fakeStorage();
    createThreadsStore("r1", storage).setCollapsed([comment("a")], true);
    expect(createThreadsStore("r1", storage).isCollapsed([comment("a")])).toBe(true);
    expect(createThreadsStore("r2", storage).isCollapsed([comment("a")])).toBe(false);
    storage.data[`${PREFS_PREFIX}threads-r3`] = "{not json";
    expect(createThreadsStore("r3", storage).isCollapsed([comment("a")])).toBe(false);
  });
});
