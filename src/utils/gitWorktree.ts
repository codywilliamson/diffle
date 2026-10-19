// detached worktree helpers for the lsp workspace. everything here runs against the worktree
// (or only adds/removes git's own worktree metadata); the user's checkout, index and HEAD are never written.

import { rmSync } from "node:fs";
import { resolve } from "node:path";
import { runGit } from "./git";

const NO_HOOKS = ["-c", "core.hooksPath=/dev/null"]; // a post-checkout hook must not run for a temp copy
const COMMIT_SUFFIX = "^{commit}";

// full commit hash for any ref, or undefined when it does not name a commit.
export function resolveCommitHash(ref: string, cwd: string): string | undefined {
  try { return runGit(["rev-parse", "--verify", "--quiet", `${ref}${COMMIT_SUFFIX}`], cwd).trim() || undefined; } catch { return undefined; }
}

// `--no-optional-locks` keeps status from refreshing (rewriting) the index of the checkout it asks about.
export function isCheckoutClean(dir: string): boolean {
  try { return runGit(["--no-optional-locks", "status", "--porcelain"], dir).trim() === ""; } catch { return false; }
}

export function addDetachedWorktree(repo: string, path: string, commit: string): void {
  runGit([...NO_HOOKS, "worktree", "add", "--detach", "--force", path, commit], repo);
}

export function moveDetachedWorktree(path: string, commit: string): void {
  runGit([...NO_HOOKS, "checkout", "--detach", "--quiet", commit], path);
}

// remove the worktree, then prune whatever git still lists for a directory that is gone.
export function removeWorktree(repo: string, path: string): void {
  try { runGit(["worktree", "remove", "--force", path], repo); } catch { rmSync(path, { recursive: true, force: true, maxRetries: 3 }); }
  try { runGit(["worktree", "prune"], repo); } catch { /* not a repo any more */ }
}

// every worktree path git has registered for the repository containing cwd.
export function listWorktreePaths(cwd: string): string[] {
  try {
    return runGit(["worktree", "list", "--porcelain"], cwd).split(/\r?\n/)
      .filter((line) => line.startsWith("worktree ")).map((line) => resolve(line.slice("worktree ".length)));
  } catch { return []; }
}
