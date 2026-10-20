// a temp worktree holds tracked files only, so a typescript server there cannot see installed
// packages. each package directory (one with a tracked package.json) gets the user's own
// node_modules linked in: a junction on windows, a symlink elsewhere. links are only ever
// removed as links, never recursed into, so the user's node_modules is never touched.

import { existsSync, lstatSync, mkdirSync, realpathSync, rmdirSync, statSync, symlinkSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { runGuardedGit } from "../../utils/gitWorktree";

const DEPENDENCY_DIR = "node_modules";
const PACKAGE_FILE = "package.json";
export const MAX_PACKAGE_DIRS = 50;
export const LIMITED_NOTE = "dependencies unavailable";

export interface LinkResult { links: string[]; limited: boolean }

function packageDirs(worktree: string): string[] {
  try {
    const files = runGuardedGit(["ls-files", "-z", "--", `:(glob)**/${PACKAGE_FILE}`], worktree).split("\0").filter(Boolean);
    return files.map((file) => file.slice(0, -PACKAGE_FILE.length).replace(/\/$/, "")).slice(0, MAX_PACKAGE_DIRS);
  } catch { return []; }
}

// links what exists and is not linked yet; `limited` when some package directory ends up without dependencies.
// `planned` hears of each link just before it is made, so a kill never leaves a link nobody wrote down.
export function linkDependencies(checkout: string, worktree: string, known: readonly string[] = [], planned: (link: string) => void = () => {}): LinkResult {
  const links = [...known];
  let limited = false;
  for (const dir of packageDirs(worktree)) {
    const link = join(worktree, dir, DEPENDENCY_DIR);
    if (links.includes(link)) continue;
    try {
      const source = realpathSync.native(join(checkout, dir, DEPENDENCY_DIR));
      if (!statSync(source).isDirectory()) throw new Error("not a directory");
      if (existsSync(link) || lstatSync(link, { throwIfNoEntry: false })) throw new Error("already there");
      mkdirSync(dirname(link), { recursive: true });
      planned(link);
      symlinkSync(source, link, "junction");
      links.push(link);
    } catch { limited = true; }
  }
  return { links, limited };
}

// removes the links themselves; false when one could not be removed (the caller must then not delete the tree).
export function unlinkDependencies(links: readonly string[]): boolean {
  let ok = true;
  for (const link of links) {
    try {
      const stat = lstatSync(link, { throwIfNoEntry: false });
      if (!stat) continue;
      if (!stat.isSymbolicLink()) { ok = false; continue; } // never delete something that is not our link
      try { unlinkSync(link); } catch { rmdirSync(link); } // a windows junction goes with rmdir, and only if it is a link
    } catch { ok = false; }
  }
  return ok;
}
