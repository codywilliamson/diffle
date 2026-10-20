// detached worktree helpers for the lsp workspace. everything here runs against the worktree
// (or only adds/removes git's own entry for it); the user's checkout, index and HEAD are never
// written, and no other worktree's registration is ever touched.

import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { runGit } from "./git";

// a configured fsmonitor is a program git would run on status/checkout; nothing here may trigger it
const GUARD = ["-c", "core.fsmonitor=false"];
export const runGuardedGit = (args: string[], cwd: string): string => runGit([...GUARD, ...args], cwd);
const NO_HOOKS = ["-c", "core.hooksPath=/dev/null"]; // a post-checkout hook must not run for a temp copy
const COMMIT_SUFFIX = "^{commit}";
const CASE_INSENSITIVE = process.platform === "win32" || process.platform === "darwin";
const fold = (path: string): string => { const flat = resolve(path).replaceAll("\\", "/"); return CASE_INSENSITIVE ? flat.toLowerCase() : flat; };

// full commit hash for any ref, or undefined when it does not name a commit.
export function resolveCommitHash(ref: string, cwd: string): string | undefined {
  try { return runGuardedGit(["rev-parse", "--verify", "--quiet", `${ref}${COMMIT_SUFFIX}`], cwd).trim() || undefined; } catch { return undefined; }
}

// `--no-optional-locks` keeps status from refreshing (rewriting) the index of the checkout it asks about.
// `ignoredUntracked` are paths we put there ourselves (dependency links); they are not local changes.
export function isCheckoutClean(dir: string, ignoredUntracked: readonly string[] = []): boolean {
  try {
    const ours = new Set(ignoredUntracked.flatMap((path) => [`?? ${path}`, `?? ${path}/`]));
    return runGuardedGit(["--no-optional-locks", "status", "--porcelain", "-z"], dir).split("\0").filter(Boolean).every((entry) => ours.has(entry));
  } catch { return false; }
}

export function addDetachedWorktree(repo: string, path: string, commit: string): void {
  runGuardedGit([...NO_HOOKS, "worktree", "add", "--detach", "--force", path, commit], repo);
}

export function moveDetachedWorktree(path: string, commit: string): void {
  runGuardedGit([...NO_HOOKS, "checkout", "--detach", "--quiet", commit], path);
}

// git's own bookkeeping dir for a linked worktree, found by the gitdir file pointing at `path`.
function adminDirOf(repo: string, path: string): string | undefined {
  try {
    const common = resolve(repo, runGuardedGit(["rev-parse", "--git-common-dir"], repo).trim());
    const entries = join(common, "worktrees");
    for (const name of readdirSync(entries)) {
      const gitdir = join(entries, name, "gitdir");
      if (existsSync(gitdir) && fold(readFileSync(gitdir, "utf8").trim().replace(/[\\/]\.git$/, "")) === fold(path)) return join(entries, name);
    }
  } catch { /* no entries */ }
  return undefined;
}

// removes exactly this worktree: its directory and its own entry under .git/worktrees. no repo-wide
// prune, so other (even stale) registrations survive. callers unlink dependency links first.
export function removeWorktree(repo: string, path: string): void {
  try { runGuardedGit(["worktree", "remove", "--force", path], repo); } catch { rmSync(path, { recursive: true, force: true, maxRetries: 3 }); }
  const admin = adminDirOf(repo, path);
  if (admin) rmSync(admin, { recursive: true, force: true });
}

// every worktree path git has registered for the repository containing cwd. NUL-delimited where git
// supports it (2.36+); older git prints the same raw paths one per line, which only newlines in a path break.
export function listWorktreePaths(cwd: string): string[] {
  let fields: string[];
  try {
    fields = runGuardedGit(["worktree", "list", "--porcelain", "-z"], cwd).split("\0");
  } catch {
    try { fields = runGuardedGit(["worktree", "list", "--porcelain"], cwd).split(/\r?\n/); } catch { return []; }
  }
  return fields.filter((field) => field.startsWith("worktree ")).map((field) => resolve(field.slice("worktree ".length)));
}
