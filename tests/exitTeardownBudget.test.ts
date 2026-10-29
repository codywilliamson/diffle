// exit paths (ctrl+c, ctrl+break, a closing console) get a few seconds in all on windows, so killing
// many servers must cost one batch, not one process start per server.

import { afterEach, describe, expect, it } from "bun:test";
import { rmSync } from "node:fs";
import { killTreesNow } from "../src/core/lsp/processGroup";
import { fakePool, isAlive, scriptFake, tempDir, waitFor } from "./helpers/fakeLspPool";

const SERVERS = 4;
const BATCH_BUDGET_MS = 3_000;
const spawned: Bun.Subprocess[] = [];
const dirs: string[] = [];
afterEach(() => {
  for (const proc of spawned.splice(0)) { try { proc.kill(); } catch { /* gone */ } }
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  delete process.env.FAKE_LSP;
});

// a process that idles until killed; on posix it leads its own group, like a language server does
function spawnIdle(): number {
  const proc = Bun.spawn([process.execPath, "-e", "setInterval(() => {}, 1000)"], { stdout: "ignore", stderr: "ignore", detached: process.platform !== "win32" });
  spawned.push(proc);
  return proc.pid;
}

describe("killTreesNow", () => {
  it("kills every tree in one call, in under the exit budget", async () => {
    const pids = Array.from({ length: SERVERS }, spawnIdle);
    expect(pids.every(isAlive)).toBe(true);
    const started = Date.now();
    killTreesNow(pids);
    expect(Date.now() - started).toBeLessThan(BATCH_BUDGET_MS);
    await waitFor(() => pids.every((pid) => !isAlive(pid)), 4_000);
  });

  // a server can die on its own before exit teardown; the batch must still reach the live ones
  for (const order of ["dead pid first", "dead pid last"] as const) {
    it(`still kills the live tree when one pid in the batch is already dead (${order})`, async () => {
      const [dead, live] = [spawnIdle(), spawnIdle()];
      killTreesNow([dead]);
      await waitFor(() => !isAlive(dead), 4_000);
      expect(isAlive(live)).toBe(true);
      killTreesNow(order === "dead pid first" ? [dead, live] : [live, dead]);
      await waitFor(() => !isAlive(live), 4_000);
    });
  }

  it("does nothing for an empty list", () => {
    expect(() => killTreesNow([])).not.toThrow();
  });
});

describe("LspPool.killAll with several servers", () => {
  it("kills the servers of every root in one go", async () => {
    scriptFake({});
    const root = tempDir("budget-root");
    dirs.push(root);
    const pool = fakePool(root);
    const bridges = await Promise.all(Array.from({ length: SERVERS }, (_, i) => pool.ensure("typescript", `${root}/r${i}`)));
    const pids = bridges.map((bridge) => bridge!.pid!);
    expect(new Set(pids).size).toBe(SERVERS);
    expect(pids.every(isAlive)).toBe(true);
    const started = Date.now();
    pool.killAll();
    expect(Date.now() - started).toBeLessThan(BATCH_BUDGET_MS);
    await waitFor(() => pids.every((pid) => !isAlive(pid)), 4_000);
  });
});
