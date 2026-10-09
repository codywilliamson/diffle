// the new side of a review as files and folders: working tree, index, or a ref.

import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runGit } from "../../utils/git";

export interface Snapshot {
  read(path: string): string | null; // file content, null when missing
  list(dir: string): string[]; // names of the files directly inside dir ("" = cwd), [] when missing
}

const cached = <T>(load: (key: string) => T): ((key: string) => T) => {
  const cache = new Map<string, T>();
  return (key) => {
    if (!cache.has(key)) cache.set(key, load(key));
    return cache.get(key) as T;
  };
};

const attempt = <T>(fallback: T, run: () => T): T => {
  try {
    return run();
  } catch {
    return fallback;
  }
};

// git lists paths relative to cwd; keep the direct children of dir
function directChildren(output: string, dir: string): string[] {
  const prefix = dir ? `${dir}/` : "";
  return output
    .split("\0")
    .filter((p) => p.startsWith(prefix) && !p.slice(prefix.length).includes("/"))
    .map((p) => p.slice(prefix.length))
    .filter(Boolean);
}

// newRef: null = working tree, "" = staged index, otherwise a git ref. paths are relative to cwd.
export function createSnapshot(cwd: string, newRef: string | null): Snapshot {
  const readOne = (path: string): string | null =>
    attempt(null, () => (newRef === null ? readFileSync(resolve(cwd, path), "utf8") : runGit(["show", `${newRef}:./${path}`], cwd)));
  const listOne = (dir: string): string[] =>
    attempt([], () => {
      if (newRef === null) return readdirSync(resolve(cwd, dir || "."), { withFileTypes: true }).filter((e) => !e.isDirectory()).map((e) => e.name);
      const spec = dir ? `${dir}/` : "./";
      const out = newRef === "" ? runGit(["ls-files", "-z", "--", spec], cwd) : runGit(["ls-tree", "-z", "--name-only", newRef, "--", spec], cwd);
      return directChildren(out, dir);
    });
  return { read: cached(readOne), list: cached(listOne) };
}
