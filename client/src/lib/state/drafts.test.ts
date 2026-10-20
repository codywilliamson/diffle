import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiRequestError } from "$lib/api/http";
import { addDraftKey, commentDraftKeys, editDraftKey, replyDraftKey } from "./draftKeys";
import {
  DRAFT_RETRY_BASE_MS,
  DRAFT_RETRY_MAX_MS,
  DRAFT_SAVE_DEBOUNCE_MS,
  KEEPALIVE_MAX_BYTES,
  createDraftsStore,
  type DraftsDeps,
} from "./drafts.svelte";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const OK = { drafts: {} };
const setup = (over: Partial<DraftsDeps> = {}) => {
  const save = vi.fn<DraftsDeps["save"]>().mockResolvedValue(OK);
  const store = createDraftsStore({ load: async () => ({}), save, ...over });
  return { store, save };
};
const keysOf = (save: ReturnType<typeof setup>["save"], call = 0) => save.mock.calls[call]![0].map((u) => u.key);

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
    expect(save).toHaveBeenCalledWith([{ key: "k", text: "hello" }], false);
  });

  it("sends every dirty draft in one batch", async () => {
    const { store, save } = setup();
    store.set("a", "1");
    store.set("b", "2");
    await vi.advanceTimersByTimeAsync(DRAFT_SAVE_DEBOUNCE_MS);
    expect(save).toHaveBeenCalledTimes(1);
    expect(keysOf(save)).toEqual(["a", "b"]);
  });

  it("clear removes it now and tells the server right away", async () => {
    const { store, save } = setup();
    store.set("k", "x");
    store.clear("k");
    await vi.advanceTimersByTimeAsync(0);
    expect(store.get("k")).toBeUndefined();
    expect(save).toHaveBeenLastCalledWith([{ key: "k", text: "" }], false);
  });

  it("ignores clearing a key that never had a draft", async () => {
    const { store, save } = setup();
    store.clear("nothing");
    await vi.advanceTimersByTimeAsync(DRAFT_SAVE_DEBOUNCE_MS);
    expect(save).not.toHaveBeenCalled();
  });

  it("unload flush uses keepalive, unless the batch is too big for it", async () => {
    const { store, save } = setup();
    store.set("k", "bye");
    await store.flush(true);
    expect(save).toHaveBeenLastCalledWith([{ key: "k", text: "bye" }], true);
    store.set("big", "x".repeat(KEEPALIVE_MAX_BYTES));
    await store.flush(true);
    expect(save.mock.lastCall![1]).toBe(false);
  });

  it("keeps a failed write dirty, retries with growing backoff, and stops once it lands", async () => {
    const save = vi.fn<DraftsDeps["save"]>().mockRejectedValue(new Error("The server is gone."));
    const { store } = setup({ save });
    store.set("k", "unsent");
    await vi.advanceTimersByTimeAsync(DRAFT_SAVE_DEBOUNCE_MS);
    expect(store.get("k")).toBe("unsent");
    expect(save).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(DRAFT_RETRY_BASE_MS);
    expect(save).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(DRAFT_RETRY_BASE_MS); // the second wait is longer
    expect(save).toHaveBeenCalledTimes(2);
    save.mockResolvedValue(OK);
    await vi.advanceTimersByTimeAsync(DRAFT_RETRY_BASE_MS);
    expect(save).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(DRAFT_RETRY_MAX_MS * 2);
    expect(save).toHaveBeenCalledTimes(3);
  });

  it("retryNow sends a waiting retry as soon as the server answers", async () => {
    const save = vi.fn<DraftsDeps["save"]>().mockRejectedValueOnce(new Error("gone")).mockResolvedValue(OK);
    const { store } = setup({ save });
    store.set("k", "x");
    await vi.advanceTimersByTimeAsync(DRAFT_SAVE_DEBOUNCE_MS);
    store.retryNow();
    await vi.advanceTimersByTimeAsync(0);
    expect(save).toHaveBeenCalledTimes(2);
    store.retryNow(); // nothing waiting
    expect(save).toHaveBeenCalledTimes(2);
  });

  it("one refused draft does not block the others, and is surfaced instead of retried", async () => {
    const save = vi.fn<DraftsDeps["save"]>().mockResolvedValue({ drafts: {}, rejected: [{ key: "big", reason: "draft too long to save" }] });
    const { store } = setup({ save });
    store.set("big", "x");
    store.set("ok", "y");
    await vi.advanceTimersByTimeAsync(DRAFT_SAVE_DEBOUNCE_MS);
    expect(store.rejection("big")).toBe("draft too long to save");
    expect(store.rejection("ok")).toBeNull();
    await vi.advanceTimersByTimeAsync(DRAFT_RETRY_MAX_MS);
    expect(save).toHaveBeenCalledTimes(1);
    store.set("big", "shorter"); // typing again gives it another chance
    expect(store.rejection("big")).toBeNull();
  });

  it("a whole request refused with a 4xx marks its drafts rejected instead of retrying forever", async () => {
    const save = vi.fn<DraftsDeps["save"]>().mockRejectedValue(new ApiRequestError("body too large", 413, null));
    const { store } = setup({ save });
    store.set("k", "x");
    await vi.advanceTimersByTimeAsync(DRAFT_SAVE_DEBOUNCE_MS + DRAFT_RETRY_MAX_MS);
    expect(save).toHaveBeenCalledTimes(1);
    expect(store.rejection("k")).toBe("body too large");
  });

  it("moves a draft to a new anchor, replacing nothing it should keep", async () => {
    const { store, save } = setup();
    store.set("old", "typed");
    store.move("old", "new");
    expect(store.get("old")).toBeUndefined();
    expect(store.get("new")).toBe("typed");
    await vi.advanceTimersByTimeAsync(DRAFT_SAVE_DEBOUNCE_MS);
    expect(save.mock.calls[0]![0]).toEqual([{ key: "old", text: "" }, { key: "new", text: "typed" }]);
    store.move("missing", "elsewhere");
    expect(store.get("elsewhere")).toBeUndefined();
  });

  it("loads server drafts without overwriting what was typed meanwhile, and reports loaded", async () => {
    const { store } = setup({ load: async () => ({ a: "from server", b: "also server" }) });
    expect(store.loaded).toBe(false);
    store.set("a", "typed first");
    await store.load();
    expect(store.loaded).toBe(true);
    expect(store.get("a")).toBe("typed first");
    expect(store.get("b")).toBe("also server");
  });

  it("survives a failed load and still reports loaded", async () => {
    const { store } = setup({ load: async () => { throw new Error("down"); } });
    await expect(store.load()).resolves.toBeUndefined();
    expect(store.loaded).toBe(true);
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
