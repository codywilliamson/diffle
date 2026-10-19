// `nittle cleanup` removes detached worktrees a killed run left behind, and nothing else.

import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findOrphanWorktrees, removeOrphanWorktrees } from "../src/core/lsp/orphanWorktrees";
import { WORKTREE_PREFIX } from "../src/core/lsp/workspace";
import { listWorktreePaths } from "../src/utils/gitWorktree";
import { gitRepo } from "./helpers/lspHttp";

const git = (cwd: string, ...args: string[]) => {
  const proc = Bun.spawnSync(["git", ...args], { cwd });
  if (proc.exitCode !== 0) throw new Error(proc.stderr.toString());
};
const addWorktree = (repo: string, dir: string) => { const path = join(dir, "new"); git(repo, "worktree", "add", "--detach", path, "HEAD"); return path; };
const deadPid = (): number => { const proc = Bun.spawnSync([process.execPath, "--version"]); return proc.pid; };

describe("leftover worktrees", () => {
  test("only dead-pid worktrees under the product prefix in this repo's list are removed", () => {
    const repo = gitRepo({ "a.ts": "x\n" });
    const dead = addWorktree(repo, mkdtempSync(join(tmpdir(), `${WORKTREE_PREFIX}${deadPid()}-`)));
    const live = addWorktree(repo, mkdtempSync(join(tmpdir(), `${WORKTREE_PREFIX}${process.pid}-`)));
    const lookalike = addWorktree(repo, mkdtempSync(join(tmpdir(), `other-lsp-wt-${deadPid()}-`)));
    const elsewhere = addWorktree(repo, join(mkdtempSync(join(tmpdir(), "elsewhere-")), `${WORKTREE_PREFIX}${deadPid()}-manual`));
    const strangerRepo = gitRepo({ "b.ts": "y\n" });
    const stranger = addWorktree(strangerRepo, mkdtempSync(join(tmpdir(), `${WORKTREE_PREFIX}${deadPid()}-`)));

    const found = findOrphanWorktrees(repo);
    const norm = (path: string) => realpathSync.native(path).replaceAll("\\", "/").toLowerCase();
    expect(found.map(norm)).toEqual([norm(dead)]);

    removeOrphanWorktrees(repo, found);
    expect(existsSync(dead)).toBe(false);
    for (const kept of [live, lookalike, elsewhere]) expect(existsSync(kept)).toBe(true);
    expect(listWorktreePaths(repo)).toHaveLength(4); // the checkout + the three kept
    expect(existsSync(stranger)).toBe(true);
    expect(listWorktreePaths(strangerRepo)).toHaveLength(2);
  });

  test("a directory that is already gone is pruned from git's list", () => {
    const repo = gitRepo({ "a.ts": "x\n" });
    const dir = mkdtempSync(join(tmpdir(), `${WORKTREE_PREFIX}${deadPid()}-`));
    const path = addWorktree(repo, dir);
    require("node:fs").rmSync(dir, { recursive: true, force: true });
    removeOrphanWorktrees(repo, findOrphanWorktrees(repo));
    expect(listWorktreePaths(repo)).toHaveLength(1);
    expect(existsSync(path)).toBe(false);
  });
});
