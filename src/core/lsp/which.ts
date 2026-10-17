// finds an executable on PATH. Bun.which already walks PATHEXT on windows (.cmd/.exe), so this
// walks PATH one entry at a time and refuses any hit whose real path is inside the repository
// under review: a checkout must never get to pick a binary we run with the user's rights.

import { existsSync, realpathSync, statSync } from "node:fs";
import { delimiter } from "node:path";
import { containsPath } from "../../utils/pathWithin";

export interface FindOptions {
  searchPath?: string; // test override for PATH
  excludeRoots?: readonly string[]; // the repository root and its worktrees
}
export interface FindResult {
  path: string | undefined;
  rejected: boolean; // a match existed but sat inside an excluded root
}

const CASE_INSENSITIVE = process.platform === "win32" || process.platform === "darwin";
const fold = (path: string): string => (CASE_INSENSITIVE ? path.toLowerCase() : path);

function isFile(path: string): boolean {
  try { return existsSync(path) && statSync(path).isFile(); } catch { return false; }
}

function realOrSelf(path: string): string {
  try { return realpathSync(path); } catch { return path; }
}

function insideAny(path: string, roots: readonly string[]): boolean {
  const real = fold(realOrSelf(path));
  return roots.some((root) => containsPath(fold(realOrSelf(root)), real));
}

export function findExecutable(command: string, options: FindOptions = {}): FindResult {
  const roots = options.excludeRoots ?? [];
  let rejected = false;
  const accept = (candidate: string | null | undefined): string | undefined => {
    if (!candidate) return undefined;
    if (insideAny(candidate, roots)) { rejected = true; return undefined; }
    return candidate;
  };
  if (command.includes("/") || command.includes("\\")) return { path: isFile(command) ? accept(command) : undefined, rejected };
  for (const dir of (options.searchPath ?? process.env.PATH ?? "").split(delimiter)) {
    if (!dir) continue;
    const found = accept(Bun.which(command, { PATH: dir }));
    if (found) return { path: found, rejected };
  }
  return { path: undefined, rejected };
}
