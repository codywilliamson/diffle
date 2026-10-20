import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addDraftKey, commentDraftKeys, editDraftKey, replyDraftKey } from "./draftKeys";
import { DRAFT_SAVE_DEBOUNCE_MS, createDraftsStore, type DraftsDeps } from "./drafts.svelte";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const setup = (over: Partial<DraftsDeps> = {}) => {
  const save = vi.fn<DraftsDeps["save"]>().mockResolvedValue({});
  const store = createDraftsStore({ load: async () => ({}), save, ...over });
  return { store, save };
};

describe("drafts store", () => {
  it("debounces server writes to the last text", async () => {
    const { store, save } = setup();
    store.set("k", "h");
    store.set("k", "he");
    store.set("k", "hello");
    expect(store.get("k")).toBe("hello");
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(DRAFT_SAVE_DEBOUNCE_MS);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith("k", "hello");
  });

  it("clear removes it now and tells the server right away", async () => {
    const { store, save } = setup();
    store.set("k", "x");
    store.clear("k");
    await vi.advanceTimersByTimeAsync(0);
    expect(store.get("k")).toBeUndefined();
    expect(save).toHaveBeenLastCalledWith("k", "");
  });

  it("ignores clearing a key that never had a draft", async () => {
    const { store, save } = setup();
    store.clear("nothing");
    await vi.advanceTimersByTimeAsync(DRAFT_SAVE_DEBOUNCE_MS);
    expect(save).not.toHaveBeenCalled();
  });

  it("keeps the draft in memory while the server is gone and flushes it on recovery", async () => {
    const save = vi.fn<DraftsDeps["save"]>().mockRejectedValue(new Error("The server is gone."));
    const { store } = setup({ save });
    store.set("k", "unsent");
    await vi.advanceTimersByTimeAsync(DRAFT_SAVE_DEBOUNCE_MS);
    expect(store.get("k")).toBe("unsent");
    expect(save).toHaveBeenCalledTimes(1);

    save.mockResolvedValue({});
    await store.flush();
    expect(save).toHaveBeenLastCalledWith("k", "unsent");
    await store.flush();
    expect(save).toHaveBeenCalledTimes(2); // saved, no longer dirty
  });

  it("loads server drafts without overwriting what was typed meanwhile", async () => {
    const { store } = setup({ load: async () => ({ a: "from server", b: "also server" }) });
    store.set("a", "typed first");
    await store.load();
    expect(store.get("a")).toBe("typed first");
    expect(store.get("b")).toBe("also server");
  });

  it("survives a failed load", async () => {
    const { store } = setup({ load: async () => { throw new Error("down"); } });
    await expect(store.load()).resolves.toBeUndefined();
    expect(store.get("k")).toBeUndefined();
  });
});

describe("draft keys", () => {
  it("separates anchors by file, side and range, and file-level from line comments", () => {
    const keys = [
      addDraftKey({ file: "a.ts", side: "new", line: 3, endLine: 3 }),
      addDraftKey({ file: "a.ts", side: "old", line: 3, endLine: 3 }),
      addDraftKey({ file: "a.ts", side: "new", line: 3, endLine: 5 }),
      addDraftKey({ file: "b.ts", side: "new", line: 3, endLine: 3 }),
      addDraftKey({ file: "a.ts", line: null }),
    ];
    expect(new Set(keys).size).toBe(keys.length);
    expect(addDraftKey({ file: "a.ts", line: 3 })).toBe(keys[0]);
  });

  it("keys edit and reply boxes by comment id", () => {
    expect(editDraftKey("c1")).not.toBe(replyDraftKey("c1"));
    expect(commentDraftKeys("c1")).toEqual([editDraftKey("c1"), replyDraftKey("c1")]);
  });
});
