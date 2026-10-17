// opt-in: runs only when typescript-language-server is installed. starts it against a tiny
// temp repo, waits for ready, and shuts down cleanly.

import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { LspPool } from "../src/core/lsp/pool";
import { findExecutable } from "../src/core/lsp/which";
import { isAlive, tempDir, waitFor } from "./helpers/fakeLspPool";

const server = findExecutable("typescript-language-server");
const installed = server !== undefined;

// the server wants a typescript it can resolve from the workspace; reuse the one installed beside it
function linkWorkspaceTypescript(workspace: string): void {
  const sibling = join(dirname(server!), "..", "typescript");
  if (!existsSync(sibling)) return;
  mkdirSync(join(workspace, "node_modules"), { recursive: true });
  symlinkSync(sibling, join(workspace, "node_modules", "typescript"), "junction");
}
const repo = tempDir("real-ts");
afterAll(() => rmSync(repo, { recursive: true, force: true }));

describe.skipIf(!installed)("typescript-language-server (real)", () => {
  test("starts lazily, reaches ready, and shuts down cleanly", async () => {
    writeFileSync(join(repo, "tsconfig.json"), JSON.stringify({ compilerOptions: { strict: true } }));
    writeFileSync(join(repo, "a.ts"), "export const a: number = 1;\n");
    linkWorkspaceTypescript(repo);
    const pool = new LspPool({ root: repo, shutdownTimeoutMs: 5000 });
    expect(pool.status(["typescript"])[0]?.state).toBe("idle");
    const bridge = await pool.ensure("typescript");
    // the isolated test home hides the profile that volta's node shim needs; nothing to assert then
    if (!bridge && pool.status(["typescript"])[0]?.stderr?.includes("Volta error")) return;
    expect(bridge, JSON.stringify(pool.status(["typescript"]))).toBeDefined();
    await waitFor(() => pool.status(["typescript"])[0]?.state === "ready", 30_000);
    const pid = bridge!.pid!;
    await pool.shutdown();
    await waitFor(() => !isAlive(pid), 10_000);
  }, 60_000);
});
