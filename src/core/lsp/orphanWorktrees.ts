// `nittle cleanup` side of the detached worktrees: finds what a killed run left behind.
// a leftover qualifies only when its <tmp>/<prefix><pid>-<random>/ dir sits directly under the temp
// dir and its ownership note names this repository and a pid that is no longer running. the note is
// written before anything is created, so a run killed mid-creation shows up as a planned worktree
// that is registered (remove it), half-made (remove the empty dir) or never made (just the dir).

import { readdirSync, realpathSync, rmSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve, sep } from "node:path";
import { listWorktreePaths, removeWorktree, runGuardedGit } from "../../utils/gitWorktree";
import { unlinkDependencies } from "./dependencyLinks";
import { WORKTREE_PREFIX } from "./workspace";
import { OWNER_FILE, OWNER_TEMP_PREFIX, readOwnership } from "./worktreeOwnership";

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
export interface Orphan { dir: string; worktrees: string[]; links: string[] } // paths the note planned, for `new`/`old` leaves of dir

function repoTopLevel(cwd: string): string | undefined {
  try { return runGuardedGit(["rev-parse", "--show-toplevel"], cwd).trim(); } catch { return undefined; }
}

export function findOrphanWorktrees(cwd: string, options: OrphanOptions = {}): Orphan[] {
  const top = repoTopLevel(cwd);
  if (!top) return [];
  const temp = options.tempDir ?? tmpdir();
  const isAlive = options.isAlive ?? isProcessAlive;
  let names: string[];
  try { names = readdirSync(temp); } catch { return []; }
  const found: Orphan[] = [];
  for (const name of names) {
    const pid = OWNER_PID.exec(name)?.[1];
    if (pid === undefined) continue;
    const dir = join(temp, name);
    const owner = readOwnership(dir);
    if (!owner || owner.pid !== Number(pid) || isAlive(owner.pid) || !same(owner.repo, top)) continue;
    const worktrees = owner.worktrees.filter((path) => LEAF_NAMES.has(basename(path)) && same(dirname(path), dir));
    if (worktrees.length !== owner.worktrees.length) continue; // a note naming anything else is not one of ours
    found.push({ dir, worktrees, links: owner.links.filter((link) => worktrees.some((path) => insideOrAt(path, dirname(link)))) });
  }
  return found;
}

// removes each orphan: links as links first, then the worktree (when git has it) or just an empty dir.
export function removeOrphanWorktrees(cwd: string, orphans: readonly Orphan[]): Orphan[] {
  const top = repoTopLevel(cwd) ?? cwd;
  const registered = listWorktreePaths(cwd);
  const cleaned: Orphan[] = [];
  for (const orphan of orphans) {
    if (!unlinkDependencies(orphan.links)) continue; // cannot prove the user's files are safe from the removal
    let ok = true;
    for (const path of orphan.worktrees) {
      try {
        if (registered.some((entry) => same(entry, path))) removeWorktree(top, path);
        else rmdirSync(path); // planned or half made: only an empty directory goes
      } catch (error) { ok = (error as NodeJS.ErrnoException).code === "ENOENT" ? ok : false; }
    }
    if (!ok) continue;
    try {
      for (const name of readdirSync(orphan.dir)) if (name === OWNER_FILE || name.startsWith(OWNER_TEMP_PREFIX)) rmSync(join(orphan.dir, name), { force: true });
      rmdirSync(orphan.dir);
    } catch { /* something else lives there: leave it */ }
    cleaned.push(orphan);
  }
  return cleaned;
}
