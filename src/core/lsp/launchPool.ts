// builds the pool for one review: workspace root is the repository root, falling back to cwd
// outside a git repo. nothing starts here; servers start on the first request for a language.

import { resolve } from "node:path";
import { runGit } from "../../utils/git";
import { readUserState } from "../userState";
import { mergeOverrides, type LspOverrides } from "./overrides";
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

// the repository root plus the checkouts whose binaries are never run.
export function lspRoots(cwd: string): { root: string; excludeRoots: string[] } {
  const root = repositoryRoot(cwd);
  return { root, excludeRoots: [root, ...worktreeRoots(cwd)] };
}

// stored overrides from the user state file, with this run's `--lsp` overrides on top.
export function effectiveOverrides(runOverrides?: LspOverrides): LspOverrides {
  return mergeOverrides(readUserState().lspOverrides, runOverrides);
}

export function createLspPool(cwd: string, enabled: boolean, runOverrides?: LspOverrides): LspPool {
  if (!enabled) return new LspPool({ root: resolve(cwd), enabled });
  return new LspPool({ ...lspRoots(cwd), enabled, overrides: effectiveOverrides(runOverrides) });
}
