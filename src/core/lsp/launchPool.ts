// builds the pool for one review: workspace root is the repository root, falling back to cwd
// outside a git repo. nothing starts here; servers start on the first request for a language.

import { resolve } from "node:path";
import { runGit } from "../../utils/git";
import { LspPool } from "./pool";

function repositoryRoot(cwd: string): string {
  try { return resolve(runGit(["rev-parse", "--show-toplevel"], cwd).trim()); } catch { return resolve(cwd); }
}

export function createLspPool(cwd: string, enabled: boolean): LspPool {
  return new LspPool({ root: enabled ? repositoryRoot(cwd) : resolve(cwd), enabled });
}
