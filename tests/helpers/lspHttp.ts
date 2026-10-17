// a real http server over a temp repo with a lsp pool, plus helpers to post to the lsp routes.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import type { Server } from "bun";
import type { DiffFile } from "../../src/types";
import type { LspPool } from "../../src/core/lsp/pool";
import { directoryAssets } from "../../src/server/assetSource";
import { createServer, type ServerContext } from "../../src/server/router";
import { tempDir } from "./fakeLspPool";

export function writeFiles(root: string, files: Record<string, string>): void {
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
}

const git = (cwd: string, ...args: string[]) => {
  const proc = Bun.spawnSync(["git", "-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", ...args], { cwd });
  if (proc.exitCode !== 0) throw new Error(proc.stderr.toString());
};

// a committed repo in a temp dir
export function gitRepo(files: Record<string, string>): string {
  const root = tempDir("repo");
  git(root, "init", "-q");
  writeFiles(root, files);
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", "init");
  return root;
}
export const stage = (root: string) => git(root, "add", "-A");

export const diffFile = (path: string, additionLines: number[] = []): DiffFile => ({
  path, oldPath: null, changeType: "modified", additions: additionLines.length, deletions: 0,
  hunks: additionLines.length ? [{ header: "@@", lines: additionLines.map((newLine) => ({ type: "addition", oldLine: null, newLine, content: "" })) }] : [],
});

export const fileUri = (root: string, path: string) => pathToFileURL(join(root, path)).href;

export interface Harness {
  ctx: ServerContext;
  port: number;
  post: (route: string, body: unknown, init?: RequestInit) => Promise<Response>;
  get: (route: string, init?: RequestInit) => Promise<Response>;
  stop: () => void;
}

export function startHarness(root: string, pool: LspPool | undefined, files: DiffFile[], newRef: string | null = null): Harness {
  const ctx: ServerContext = {
    diff: { ref: "working tree", files }, cwd: root, assets: directoryAssets(root), productRoot: root, newRef,
    diffArgs: [], includeUntracked: false, served: false, host: "cli", ...(pool ? { lsp: pool } : {}),
  };
  const server: Server<undefined> = createServer(ctx);
  const base = `http://127.0.0.1:${server.port}`;
  return {
    ctx, port: server.port!, stop: () => server.stop(true),
    post: (route, body, init = {}) => fetch(base + route, { method: "POST", body: JSON.stringify(body), ...init }),
    get: (route, init) => fetch(base + route, init),
  };
}
