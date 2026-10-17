import { describe, expect, test } from "bun:test";
import { JsonRpcConnection, LspCancelledError, LspClosedError, LspResponseError, LspTimeoutError } from "../src/core/lsp/jsonRpc";

// two connections wired back to back; frames cross in 7-byte slices to exercise reassembly
function pair() {
  let a!: JsonRpcConnection;
  let b!: JsonRpcConnection;
  const sentByA: string[] = [];
  const wire = (to: () => JsonRpcConnection, log?: string[]) => (frame: Uint8Array) => {
    if (log) log.push(new TextDecoder().decode(frame));
    for (let i = 0; i < frame.length; i += 7) to().receive(frame.subarray(i, i + 7));
  };
  a = new JsonRpcConnection(wire(() => b, sentByA));
  b = new JsonRpcConnection(wire(() => a));
  return { a, b, sentByA };
}

describe("json-rpc connection", () => {
  test("correlates concurrent responses by id", async () => {
    const { a, b } = pair();
    b.onRequest("echo", async (params) => { await new Promise((r) => setTimeout(r, (params as { ms: number }).ms)); return params; });
    const [slow, fast] = await Promise.all([a.request("echo", { ms: 30, n: 1 }), a.request("echo", { ms: 1, n: 2 })]);
    expect(slow).toEqual({ ms: 30, n: 1 });
    expect(fast).toEqual({ ms: 1, n: 2 });
  });

  test("error responses reject with LspResponseError", async () => {
    const { a, b } = pair();
    b.onRequest("boom", () => { throw new Error("kaput"); });
    const error = await a.request("boom").catch((e) => e);
    expect(error).toBeInstanceOf(LspResponseError);
    expect((error as LspResponseError).message).toBe("kaput");
  });

  test("unknown server-to-client requests get method-not-found", async () => {
    const { a } = pair();
    const error = await a.request("nobody/home").catch((e) => e);
    expect((error as LspResponseError).code).toBe(-32601);
  });

  test("delivers notifications to their handler", async () => {
    const { a, b } = pair();
    const seen: unknown[] = [];
    b.onNotification("note", (params) => { seen.push(params); });
    a.notify("note", { x: "日本" });
    expect(seen).toEqual([{ x: "日本" }]);
  });

  test("an abort sends $/cancelRequest and rejects with a named error", async () => {
    const { a, b, sentByA } = pair();
    b.onRequest("never", () => new Promise(() => {}));
    const controller = new AbortController();
    const pending = a.request("never", {}, { signal: controller.signal });
    controller.abort();
    const error = await pending.catch((e) => e);
    expect(error).toBeInstanceOf(LspCancelledError);
    expect((error as Error).name).toBe("LspCancelledError");
    expect(sentByA.some((frame) => frame.includes('"$/cancelRequest"') && frame.includes('"id":1'))).toBe(true);
  });

  test("an already-aborted signal rejects without sending anything", async () => {
    const { a, sentByA } = pair();
    const error = await a.request("x", {}, { signal: AbortSignal.abort() }).catch((e) => e);
    expect(error).toBeInstanceOf(LspCancelledError);
    expect(sentByA).toEqual([]);
  });

  test("a response arriving after cancel is ignored", async () => {
    const { a, b } = pair();
    let release!: () => void;
    b.onRequest("late", () => new Promise((resolve) => { release = () => resolve("too late"); }));
    const controller = new AbortController();
    const pending = a.request("late", {}, { signal: controller.signal });
    controller.abort();
    await pending.catch(() => {});
    release();
    await new Promise((r) => setTimeout(r, 10)); // nothing to assert beyond: no throw, no unhandled rejection
    expect(await a.request("late2").catch((e) => (e as Error).name)).toBe("LspResponseError");
  });

  test("a request that outlives its timeout is cancelled with LspTimeoutError", async () => {
    const { a, b, sentByA } = pair();
    b.onRequest("never", () => new Promise(() => {}));
    const error = await a.request("never", {}, { timeoutMs: 20 }).catch((e) => e);
    expect(error).toBeInstanceOf(LspTimeoutError);
    expect(sentByA.some((frame) => frame.includes("$/cancelRequest"))).toBe(true);
  });

  test("closing rejects everything in flight and fails later requests fast", async () => {
    const { a, b } = pair();
    b.onRequest("never", () => new Promise(() => {}));
    const pending = a.request("never");
    a.close();
    expect(await pending.catch((e) => e)).toBeInstanceOf(LspClosedError);
    expect(await a.request("again").catch((e) => e)).toBeInstanceOf(LspClosedError);
  });
});
