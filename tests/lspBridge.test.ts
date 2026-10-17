import { afterEach, describe, expect, test } from "bun:test";
import { pathToFileURL } from "node:url";
import type { LspBridge } from "../src/core/lsp/bridge";
import { LspCancelledError } from "../src/core/lsp/jsonRpc";
import { fakeBridge, isAlive, scriptFake, tempDir, waitFor } from "./helpers/fakeLspPool";

const open: LspBridge[] = [];
async function started(config: Record<string, unknown> = {}): Promise<LspBridge> {
  scriptFake(config);
  const bridge = fakeBridge(tempDir("bridge"));
  open.push(bridge);
  await bridge.start();
  return bridge;
}
afterEach(() => { for (const bridge of open.splice(0)) bridge.kill(); delete process.env.FAKE_LSP; });

interface FakeState { cancelled: number[]; opened: string[]; closed: string[]; replies: Record<string, any>; initParams: any }
const state = (bridge: LspBridge) => bridge.request<FakeState>("fake/state");

describe("lsp bridge", () => {
  test("initialize carries the product identity, the root and utf-16 only", async () => {
    const bridge = await started();
    const { initParams } = await state(bridge);
    expect(initParams.clientInfo.name).toBe("nittle");
    expect(initParams.rootUri).toBe(bridge.rootUri);
    expect(initParams.workspaceFolders[0].uri).toBe(bridge.rootUri);
    expect(initParams.capabilities.general.positionEncodings).toEqual(["utf-16"]);
    expect(initParams.processId).toBe(process.pid);
    expect(bridge.encoding).toBe("utf-16");
  });

  test("records the encoding the server picks", async () => {
    expect((await started({ encoding: "utf-8" })).encoding).toBe("utf-8");
  });

  test("answers the server's own requests without erroring", async () => {
    const bridge = await started({ clientRequests: true });
    let replies: FakeState["replies"] = {};
    for (let tries = 0; tries < 100 && Object.keys(replies).length < 4; tries++) {
      await new Promise((r) => setTimeout(r, 20));
      replies = (await state(bridge)).replies;
    }
    expect(replies["srv-workspace/configuration"]).toEqual([false, null]);
    expect(replies["srv-client/registerCapability"]).toBeNull();
    expect(replies["srv-window/workDoneProgress/create"]).toBeNull();
    expect(replies["srv-fake/unknownToClient"].code).toBe(-32601);
  });

  test("tracks document versions and sends didOpen/didClose once", async () => {
    const bridge = await started();
    const uri = pathToFileURL(`${tempDir("doc")}/a.ts`).href;
    expect(bridge.documentVersion(uri)).toBeUndefined();
    expect(bridge.openDocument(uri, "typescript", "let a = 1")).toBe(1);
    expect(bridge.openDocument(uri, "typescript", "let a = 1")).toBe(1);
    bridge.closeDocument(uri);
    bridge.closeDocument(uri);
    expect(bridge.documentVersion(uri)).toBeUndefined();
    const seen = await state(bridge);
    expect(seen.opened).toEqual([uri]);
    expect(seen.closed).toEqual([uri]);
  });

  test("reassembles a response the server writes in tiny pieces, multi-byte text included", async () => {
    const bridge = await started();
    expect(await bridge.request<string>("fake/partial")).toBe("héllo 🌍 日本語");
  });

  test("handles two frames arriving in one write", async () => {
    const bridge = await started();
    expect(await bridge.request<string>("fake/burst")).toBe("a");
    expect(await bridge.request<number>("fake/echo", 7)).toBe(7);
  });

  test("a superseded request is cancelled: the server is told, the promise rejects by name", async () => {
    const bridge = await started();
    const controller = new AbortController();
    const slow = bridge.request("fake/slow", { ms: 5000 }, { signal: controller.signal });
    await new Promise((r) => setTimeout(r, 50));
    controller.abort();
    expect(await slow.catch((e) => e)).toBeInstanceOf(LspCancelledError);
    expect((await state(bridge)).cancelled.length).toBe(1);
    expect(await bridge.request<string>("fake/echo", "still alive")).toBe("still alive");
  });

  test("graceful shutdown ends the process cleanly", async () => {
    const bridge = await started();
    const pid = bridge.pid!;
    await bridge.shutdown();
    await waitFor(() => !isAlive(pid));
  });

  test("a server that ignores shutdown and exit is killed after the timeout", async () => {
    const bridge = await started({ ignoreShutdown: true, ignoreExit: true });
    const pid = bridge.pid!;
    await bridge.shutdown(200);
    await waitFor(() => !isAlive(pid));
  });
});
