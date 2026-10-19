// `nittle cleanup` side of the detached worktrees: finds the ones a killed run left behind.
// a worktree qualifies only when all of these hold: git lists it for this repository, it is a
// `new` or `old` leaf of a <tmp>/<prefix><pid>-<random>/ dir directly under the temp dir, that
// dir's ownership note names this repository, this worktree and a pid that is no longer running.

import { readdirSync, realpathSync, rmSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve, sep } from "node:path";
import { runGit } from "../../utils/git";
import { listWorktreePaths, removeWorktree } from "../../utils/gitWorktree";
import { unlinkDependencies } from "./dependencyLinks";
import { WORKTREE_PREFIX } from "./workspace";
import { OWNER_FILE, readOwnership } from "./worktreeOwnership";

const CASE_INSENSITIVE = process.platform === "win32" || process.platform === "darwin";
const LEAF_NAMES = new Set(["new", "old"]);
const OWNER_PID = new RegExp(`^${WORKTREE_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\d+)-`);

const fold = (path: string): string => (CASE_INSENSITIVE ? path.toLowerCase() : path);
const real = (path: string): string => { try { return realpathSync.native(path); } catch { return resolve(path); } };
const same = (a: string, b: string): boolean => fold(real(a)) === fold(real(b));
const insideOrAt = (root: string, dir: string): boolean => { const inner = fold(real(dir)); const outer = fold(real(root)); return inner === outer || inner.startsWith(outer + sep); };

export function isProcessAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true; } catch (error) { return (error as NodeJS.ErrnoException).code === "EPERM"; }
}

export interface OrphanOptions { tempDir?: string; isAlive?: (pid: number) => boolean }

function repoTopLevel(cwd: string): string | undefined {
  try { return runGit(["rev-parse", "--show-toplevel"], cwd).trim(); } catch { return undefined; }
}

export function findOrphanWorktrees(cwd: string, options: OrphanOptions = {}): string[] {
  const top = repoTopLevel(cwd);
  if (!top) return [];
  const temp = options.tempDir ?? tmpdir();
  const isAlive = options.isAlive ?? isProcessAlive;
  return listWorktreePaths(cwd).filter((path) => {
    const parent = dirname(path);
    const pid = OWNER_PID.exec(basename(parent))?.[1];
    if (pid === undefined || !LEAF_NAMES.has(basename(path)) || !same(dirname(parent), temp)) return false;
    const owner = readOwnership(parent);
    return !!owner && owner.pid === Number(pid) && !isAlive(owner.pid) && same(owner.repo, top) && owner.worktrees.some((owned) => same(owned, path));
  });
}

// returns the paths that were removed. links are unlinked as links first; a parent dir goes only when empty.
export function removeOrphanWorktrees(cwd: string, paths: readonly string[]): string[] {
  const top = repoTopLevel(cwd) ?? cwd;
  const removed: string[] = [];
  for (const path of paths) {
    const parent = dirname(path);
    const links = (readOwnership(parent)?.links ?? []).filter((link) => insideOrAt(path, dirname(link)));
    if (!unlinkDependencies(links)) continue; // cannot prove the user's files are safe from the removal
    try { removeWorktree(top, path); removed.push(path); } catch { /* leave it for the next run */ }
  }
  for (const parent of new Set(removed.map((path) => dirname(path)))) {
    try {
      if (readdirSync(parent).some((name) => name !== OWNER_FILE)) continue; // keep the note until the last worktree is gone
      rmSync(join(parent, OWNER_FILE), { force: true });
      rmdirSync(parent);
    } catch { /* already gone */ }
  }
  return removed;
}
