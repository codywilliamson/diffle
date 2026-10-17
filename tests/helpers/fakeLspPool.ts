// builds lsp pools/bridges backed by tests/fixtures/fakeLsp.ts, configured through FAKE_LSP.

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LspBridge } from "../../src/core/lsp/bridge";
import { LspPool, type PoolOptions } from "../../src/core/lsp/pool";
import type { LanguageEntry } from "../../src/core/lsp/registry";

export const FAKE_LSP_PATH = join(import.meta.dir, "..", "fixtures", "fakeLsp.ts");

export function tempDir(label = "lsp"): string {
  return mkdtempSync(join(tmpdir(), `nittle-test-${label}-`));
}

export function fakeEntry(): LanguageEntry {
  return {
    languageIds: { ts: "typescript", cs: "csharp" },
    candidates: [{ command: process.execPath, args: () => [FAKE_LSP_PATH] }],
    installHint: "install the fake",
  };
}

// the fake reads FAKE_LSP when it launches, so set it before the first ensure()/start()
export function scriptFake(config: Record<string, unknown>): void {
  process.env.FAKE_LSP = JSON.stringify(config);
}

export function fakePool(root: string, options: Partial<PoolOptions> = {}): LspPool {
  return new LspPool({ root, registry: { typescript: fakeEntry(), csharp: fakeEntry() }, shutdownTimeoutMs: 500, ...options });
}

export function fakeBridge(root: string): LspBridge {
  return new LspBridge({ command: process.execPath, args: [FAKE_LSP_PATH], root, cwd: tempDir("bridge-cwd") });
}

export async function waitFor(check: () => boolean, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!check()) {
    if (Date.now() > deadline) throw new Error("waitFor timed out");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

export function isAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true; } catch { return false; }
}
