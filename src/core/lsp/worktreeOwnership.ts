// the note a run leaves in its temp parent dir so `nittle cleanup` can prove which worktrees are ours.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const OWNER_FILE = "owner.json";

export interface Ownership {
  pid: number;
  repo: string; // repository root the worktrees belong to
  worktrees: string[]; // absolute paths of the worktrees
  links: string[]; // dependency links inside them; removed as links before anything else
}

export function writeOwnership(dir: string, ownership: Ownership): void {
  writeFileSync(join(dir, OWNER_FILE), JSON.stringify(ownership));
}

export function readOwnership(dir: string): Ownership | undefined {
  try {
    const value = JSON.parse(readFileSync(join(dir, OWNER_FILE), "utf8")) as Partial<Ownership>;
    const strings = (list: unknown): list is string[] => Array.isArray(list) && list.every((item) => typeof item === "string");
    if (typeof value.pid !== "number" || typeof value.repo !== "string" || !strings(value.worktrees) || !strings(value.links)) return undefined;
    return { pid: value.pid, repo: value.repo, worktrees: value.worktrees, links: value.links };
  } catch { return undefined; }
}
