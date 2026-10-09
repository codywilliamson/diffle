// reads project files as they are on the new side of a review: working tree, index, or a ref.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runGit } from "../../utils/git";

export type SnapshotReader = (path: string) => string | null;

// newRef: null = working tree, "" = staged index, otherwise a git ref. paths are relative to cwd.
export function createSnapshotReader(cwd: string, newRef: string | null): SnapshotReader {
  const cache = new Map<string, string | null>();
  const load = (path: string): string | null => {
    try {
      if (newRef === null) return readFileSync(resolve(cwd, path), "utf8");
      return runGit(["show", `${newRef}:./${path}`], cwd);
    } catch {
      return null;
    }
  };
  return (path) => {
    if (!cache.has(path)) cache.set(path, load(path));
    return cache.get(path) ?? null;
  };
}
