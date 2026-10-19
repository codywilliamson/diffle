// `nittle cleanup` side of the detached worktrees: finds the ones a killed run left behind.
// a worktree qualifies only when git lists it for this repository, it sits in a
// <tmp>/<prefix><pid>-<random>/ directory this product made, and that pid is no longer running.

import { realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, resolve } from "node:path";
import { listWorktreePaths, removeWorktree } from "../../utils/gitWorktree";
import { WORKTREE_PREFIX } from "./workspace";

const CASE_INSENSITIVE = process.platform === "win32" || process.platform === "darwin";
const OWNER_PID = new RegExp(`^${WORKTREE_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\d+)-`);

const fold = (path: string): string => (CASE_INSENSITIVE ? path.toLowerCase() : path);
const real = (path: string): string => { try { return realpathSync(path); } catch { return resolve(path); } };

export function isProcessAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true; } catch (error) { return (error as NodeJS.ErrnoException).code === "EPERM"; }
}

export interface OrphanOptions { tempDir?: string; isAlive?: (pid: number) => boolean }

export function findOrphanWorktrees(cwd: string, options: OrphanOptions = {}): string[] {
  const temp = fold(real(options.tempDir ?? tmpdir()));
  const isAlive = options.isAlive ?? isProcessAlive;
  return listWorktreePaths(cwd).filter((path) => {
    const base = dirname(resolve(path));
    const pid = OWNER_PID.exec(basename(base))?.[1];
    return pid !== undefined && fold(real(dirname(base))) === temp && !isAlive(Number(pid));
  });
}

// returns the paths that were removed; each owner directory goes with its last worktree.
export function removeOrphanWorktrees(cwd: string, paths: readonly string[]): string[] {
  for (const path of paths) {
    removeWorktree(cwd, path);
    try { rmSync(dirname(path), { recursive: true, force: true }); } catch { /* the os cleans temp */ }
  }
  return [...paths];
}
