// posix only: windows has no process groups (taskkill /T covers it there)
import { afterEach, describe, expect, it } from "bun:test";
import type { LspBridge } from "../src/core/lsp/bridge";
import { KILL_GRACE_MS } from "../src/core/lsp/processGroup";
import { fakeBridge, isAlive, scriptFake, tempDir, waitFor } from "./helpers/fakeLspPool";

const POSIX = process.platform !== "win32";
const open: LspBridge[] = [];
afterEach(() => { for (const bridge of open.splice(0)) bridge.kill(); delete process.env.FAKE_LSP; });

async function started(config: Record<string, unknown>) {
  scriptFake(config);
  const bridge = fakeBridge(tempDir("group"));
  open.push(bridge);
  await bridge.start();
  const { childPid } = await bridge.request<{ childPid: number }>("fake/state");
  return { bridge, leader: bridge.pid!, child: childPid };
}

describe.skipIf(!POSIX)("language server process groups", () => {
  it("shutdown reaps a server and its child even when both ignore SIGTERM, within the grace period", async () => {
    const { bridge, leader, child } = await started({ ignoreShutdown: true, ignoreExit: true, ignoreTerm: true, spawnChild: true });
    expect(isAlive(leader) && isAlive(child)).toBe(true);
    const began = Date.now();
    await bridge.shutdown(200);
    expect(Date.now() - began).toBeLessThan(200 + KILL_GRACE_MS * 3 + 500);
    await waitFor(() => !isAlive(leader) && !isAlive(child), 1500);
  });

  it("a polite server leaves cleanly and its child goes with it", async () => {
    const { bridge, leader, child } = await started({ spawnChild: true });
    await bridge.shutdown();
    await waitFor(() => !isAlive(leader) && !isAlive(child), KILL_GRACE_MS + 1500);
  });

  it("after a crash the leftover child is killed too", async () => {
    const { bridge, leader, child } = await started({ spawnChild: true });
    await bridge.request("fake/crash").catch(() => {});
    await waitFor(() => !isAlive(leader) && !isAlive(child), KILL_GRACE_MS + 1500);
  });

  it("kill() is synchronous and takes the whole group", async () => {
    const { bridge, leader, child } = await started({ ignoreTerm: true, spawnChild: true });
    bridge.kill();
    await waitFor(() => !isAlive(leader) && !isAlive(child), 1500);
  });
});
