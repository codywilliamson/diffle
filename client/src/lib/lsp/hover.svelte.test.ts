import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LspHoverResponse, LspPositionRequest } from "$types";
import { createHoverStore, HOVER_DWELL_MS, HOVER_GRACE_MS } from "./hover.svelte";
import type { CodeHit } from "./domPosition";

function wordHit(text: string, start: number, line = 1): CodeHit {
  document.body.innerHTML = `<section data-file-path="a.ts"><span class="code-inner" data-lsp-side="new" data-lsp-line="${line}">${text}</span></section>`;
  const root = document.querySelector<HTMLElement>(".code-inner")!;
  const word = /[A-Za-z]+/.exec(text.slice(start))![0];
  return { path: "a.ts", side: "new", line, root, token: { start, end: start + word.length, text: word } };
}

function setup() {
  const asked: { request: LspPositionRequest; signal: AbortSignal; answer: (r: LspHoverResponse) => void }[] = [];
  const errors: [unknown, boolean][] = [];
  const store = createHoverStore({
    request: (request, signal) => new Promise((resolve) => asked.push({ request, signal, answer: resolve })),
    onError: (error, explicit) => errors.push([error, explicit]),
  });
  return { store, asked, errors };
}

const flush = () => vi.advanceTimersByTimeAsync(0);

describe("hover store", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("asks only after the pointer has rested for the dwell delay", async () => {
    const { store, asked } = setup();
    const hit = wordHit("call greeter now", 5);
    store.pointerOver(hit);
    await vi.advanceTimersByTimeAsync(HOVER_DWELL_MS - 1);
    expect(asked).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(asked).toHaveLength(1);
    expect(asked[0]!.request).toEqual({ path: "a.ts", side: "new", line: 1, character: 5 });
  });

  it("does not ask again while the pointer stays on the same word", async () => {
    const { store, asked } = setup();
    const hit = wordHit("call greeter now", 5);
    store.pointerOver(hit);
    store.pointerOver({ ...hit });
    await vi.advanceTimersByTimeAsync(HOVER_DWELL_MS * 3);
    store.pointerOver({ ...hit });
    await vi.advanceTimersByTimeAsync(HOVER_DWELL_MS * 3);
    expect(asked).toHaveLength(1);
  });

  it("shows the answer and nothing for an empty one", async () => {
    const { store, asked } = setup();
    store.pointerOver(wordHit("call greeter now", 5));
    await vi.advanceTimersByTimeAsync(HOVER_DWELL_MS);
    asked[0]!.answer({ contents: "   " });
    await flush();
    expect(store.card).toBeNull();

    store.pointerOver(wordHit("other thing", 6));
    await vi.advanceTimersByTimeAsync(HOVER_DWELL_MS);
    asked[1]!.answer({ contents: "```ts\nconst x: number\n```" });
    await flush();
    expect(store.card?.contents).toContain("const x: number");
  });

  it("re-targets on the next word: aborts the request in flight and drops the old card", async () => {
    const { store, asked } = setup();
    const first = wordHit("call greeter now", 5);
    store.pointerOver(first);
    await vi.advanceTimersByTimeAsync(HOVER_DWELL_MS);
    asked[0]!.answer({ contents: "first" });
    await flush();
    expect(store.card?.contents).toBe("first");

    const next = { ...first, token: { start: 13, end: 16, text: "now" } };
    store.pointerOver(next);
    expect(store.card).toBeNull();
    await vi.advanceTimersByTimeAsync(HOVER_DWELL_MS);
    expect(asked).toHaveLength(2);

    // a third word while the second request is still out
    store.pointerOver({ ...first, token: { start: 0, end: 4, text: "call" } });
    expect(asked[1]!.signal.aborted).toBe(true);
    asked[1]!.answer({ contents: "late answer for the second word" });
    await flush();
    expect(store.card).toBeNull();
  });

  it("keeps the card while the pointer is on it, and closes a grace period after it leaves", async () => {
    const { store, asked } = setup();
    store.pointerOver(wordHit("call greeter now", 5));
    await vi.advanceTimersByTimeAsync(HOVER_DWELL_MS);
    asked[0]!.answer({ contents: "docs" });
    await flush();

    store.pointerOver(null); // left the word
    store.cardEnter(); // landed on the card
    await vi.advanceTimersByTimeAsync(HOVER_GRACE_MS * 4);
    expect(store.card?.contents).toBe("docs");

    store.cardLeave();
    await vi.advanceTimersByTimeAsync(HOVER_GRACE_MS);
    expect(store.card).toBeNull();
  });

  it("closes after the grace period when the pointer just leaves the word", async () => {
    const { store, asked } = setup();
    store.pointerOver(wordHit("call greeter now", 5));
    await vi.advanceTimersByTimeAsync(HOVER_DWELL_MS);
    asked[0]!.answer({ contents: "docs" });
    await flush();
    store.pointerOver(null);
    await vi.advanceTimersByTimeAsync(HOVER_GRACE_MS - 1);
    expect(store.card).not.toBeNull();
    await vi.advanceTimersByTimeAsync(1);
    expect(store.card).toBeNull();
  });

  it("showFor (gh) asks at once and Esc (close) cancels the request in flight", async () => {
    const { store, asked } = setup();
    store.showFor(wordHit("call greeter now", 5));
    await flush();
    expect(asked).toHaveLength(1);
    expect(store.close()).toBe(false);
    expect(asked[0]!.signal.aborted).toBe(true);
    asked[0]!.answer({ contents: "late" });
    await flush();
    expect(store.card).toBeNull();
  });

  it("close reports whether a card was open", async () => {
    const { store, asked } = setup();
    store.showFor(wordHit("call greeter now", 5));
    asked[0]!.answer({ contents: "docs" });
    await flush();
    expect(store.close()).toBe(true);
    expect(store.card).toBeNull();
  });

  it("never asks about a word canAsk refuses, but gh still does", async () => {
    const asked: string[] = [];
    const store = createHoverStore({
      request: (request) => { asked.push(request.path); return new Promise(() => {}); },
      canAsk: () => false,
    });
    store.pointerOver(wordHit("call greeter now", 5));
    await vi.advanceTimersByTimeAsync(HOVER_DWELL_MS * 2);
    expect(asked).toEqual([]);
    store.showFor(wordHit("call greeter now", 5));
    await flush();
    expect(asked).toEqual(["a.ts"]);
  });

  it("passes explicit to the error callback only for gh", async () => {
    const errors: [unknown, boolean][] = [];
    const store = createHoverStore({ request: () => Promise.reject(new Error("down")), onError: (e, x) => errors.push([e, x]) });
    store.pointerOver(wordHit("call greeter now", 5));
    await vi.advanceTimersByTimeAsync(HOVER_DWELL_MS);
    store.showFor(wordHit("call greeter now", 5));
    await flush();
    expect(errors.map(([, explicit]) => explicit)).toEqual([false, true]);
  });
});
