// builds the pool for one review: workspace root is the repository root, falling back to cwd
// outside a git repo. nothing starts here; servers start on the first request for a language.

import { resolve } from "node:path";
import { runGit } from "../../utils/git";
import { LspPool } from "./pool";

function repositoryRoot(cwd: string): string {
  try { return resolve(runGit(["rev-parse", "--show-toplevel"], cwd).trim()); } catch { return resolve(cwd); }
}

// every checkout of this repository: a server planted in any of them is untrusted.
function worktreeRoots(cwd: string): string[] {
  try {
    return runGit(["worktree", "list", "--porcelain"], cwd).split(/\r?\n/)
      .filter((line) => line.startsWith("worktree ")).map((line) => resolve(line.slice("worktree ".length)));
  } catch { return []; }
}

export function createLspPool(cwd: string, enabled: boolean): LspPool {
  if (!enabled) return new LspPool({ root: resolve(cwd), enabled });
  const root = repositoryRoot(cwd);
  return new LspPool({ root, enabled, excludeRoots: [root, ...worktreeRoots(cwd)] });
}
