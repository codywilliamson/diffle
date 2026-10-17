import { describe, expect, it, vi } from "vitest";
import type { DiffFile } from "$types";
import { INTERDIFF_NOTICE, createSearchStore } from "./search.svelte";

const FILE = {
  path: "a.ts",
  hunks: [{ header: "@@", lines: [{ type: "context", oldLine: 1, newLine: 1, content: "foo" }] }],
} as unknown as DiffFile;

function store() {
  const goToLine = vi.fn();
  const search = createSearchStore({ file: (path) => (path === FILE.path ? FILE : undefined), cursorPos: () => null, goToLine });
  return { search, goToLine };
}

describe("search in the changes-since-last-review view", () => {
  it("refuses to open there and says why", () => {
    const { search } = store();
    search.setInterdiff("a.ts", true);
    search.start("a.ts", "foo");
    expect(search.open).toBe(false);
    expect(search.notice).toBe(INTERDIFF_NOTICE);
  });

  it("closes an open search when the file switches to that view", () => {
    const { search } = store();
    search.start("a.ts", "foo");
    expect(search.open).toBe(true);
    search.setInterdiff("a.ts", true);
    expect(search.open).toBe(false);
    expect(search.hitsFor("a.ts", 1, 1)).toBeUndefined();
  });

  it("works again once the view is left", () => {
    const { search } = store();
    search.setInterdiff("a.ts", true);
    search.setInterdiff("a.ts", false);
    search.start("a.ts", "foo");
    expect(search.open).toBe(true);
    expect(search.total).toBe(1);
  });

  it("is unaffected by another file being in that view", () => {
    const { search } = store();
    search.setInterdiff("b.ts", true);
    search.start("a.ts", "foo");
    expect(search.open).toBe(true);
  });
});
