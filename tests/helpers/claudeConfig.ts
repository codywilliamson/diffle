// temp-dir fixtures for the Claude Code plugin registry, plus a fake `claude` executable.

import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const dirs: string[] = [];

export function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "diffle-claude-"));
  dirs.push(dir);
  return dir;
}

export function cleanupTempDirs(): void {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
}

export function writeFile(path: string, body: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, typeof body === "string" ? body : JSON.stringify(body, null, 2));
}

const githubSource = (repo: string) => ({ source: { source: "github", repo } });

export interface StaleOptions { marketplace?: string; hook?: boolean; withProduct?: boolean; }

// mirrors a real stale install: both legacy plugins, the legacy marketplace, the enabled flag,
// and the cached plugin's .mcp.json still launching `loupe`.
export function staleConfigDir(opts: StaleOptions = {}): string {
  const { marketplace = "loupe-local", hook = true, withProduct = false } = opts;
  const dir = tempDir();
  const cache = (name: string, version: string) => join(dir, "plugins", "cache", marketplace, name, version);
  const plugins: Record<string, unknown> = {
    [`loupe-review@${marketplace}`]: [{ version: "0.1.1", scope: "user", installPath: cache("loupe-review", "0.1.1") }],
  };
  if (hook) plugins[`loupe-review-hook@${marketplace}`] = [{ version: "0.1.0", scope: "user", installPath: cache("loupe-review-hook", "0.1.0") }];
  if (withProduct) plugins["diffle-review@diffle-local"] = [{ version: "0.2.0", scope: "user", installPath: cache("diffle-review", "0.2.0") }];

  writeFile(join(dir, "plugins", "installed_plugins.json"), { version: 1, plugins });
  writeFile(join(dir, "plugins", "known_marketplaces.json"), {
    [marketplace]: { ...githubSource("codywilliamson/loupe"), installLocation: join(dir, "plugins", "marketplaces", marketplace), lastUpdated: "2026-01-01T00:00:00.000Z" },
  });
  writeFile(join(dir, "settings.json"), {
    enabledPlugins: { [`loupe-review@${marketplace}`]: true, ...(withProduct ? { "diffle-review@diffle-local": true } : {}) },
    extraKnownMarketplaces: { [marketplace]: githubSource("codywilliamson/loupe") },
  });
  writeFile(join(cache("loupe-review", "0.1.1"), ".mcp.json"), { mcpServers: { loupe: { command: "loupe", args: ["mcp", "serve"] } } });
  return dir;
}

export function healthyConfigDir(): string {
  const dir = tempDir();
  writeFile(join(dir, "plugins", "installed_plugins.json"), {
    version: 1,
    plugins: { "diffle-review@diffle-local": [{ version: "0.2.0", scope: "user", installPath: join(dir, "plugins", "cache", "diffle-local", "diffle-review", "0.2.0") }] },
  });
  writeFile(join(dir, "plugins", "known_marketplaces.json"), {
    "diffle-local": { ...githubSource("codywilliamson/diffle"), installLocation: join(dir, "plugins", "marketplaces", "diffle-local"), lastUpdated: "2026-01-01T00:00:00.000Z" },
  });
  writeFile(join(dir, "settings.json"), { enabledPlugins: { "diffle-review@diffle-local": true } });
  return dir;
}

// a `claude` shim first on PATH: logs its argv, exits with `code`. never touches a real config.
export function fakeClaude(exitCode = 0): { binDir: string; log: string } {
  const binDir = tempDir();
  const log = join(binDir, "calls.txt");
  if (process.platform === "win32") {
    writeFile(join(binDir, "claude.cmd"), `@echo off\r\necho %*>>"${log}"\r\nexit /b ${exitCode}\r\n`);
  } else {
    const script = join(binDir, "claude");
    writeFile(script, `#!/bin/sh\necho "$@" >> "${log}"\nexit ${exitCode}\n`);
    chmodSync(script, 0o755);
  }
  return { binDir, log };
}
