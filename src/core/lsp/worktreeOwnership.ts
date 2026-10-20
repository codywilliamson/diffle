// the note a run leaves in its temp parent dir so `nittle cleanup` can prove which worktrees are ours.
// it is written before anything is created (it names what is planned) and replaced atomically on
// every change: a temp file, then a rename, so a kill never leaves a half-written note.

import { readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const OWNER_FILE = "owner.json";
export const OWNER_TEMP_PREFIX = `${OWNER_FILE}.tmp-`;

export interface Ownership {
  pid: number;
  repo: string; // repository root the worktrees belong to
  worktrees: string[]; // absolute paths of the worktrees, planned or created
  links: string[]; // dependency links inside them, planned or created; removed as links before anything else
}

export function writeOwnership(dir: string, ownership: Ownership): void {
  const temp = join(dir, `${OWNER_TEMP_PREFIX}${process.pid}`);
  try {
    writeFileSync(temp, JSON.stringify(ownership));
    renameSync(temp, join(dir, OWNER_FILE));
  } catch (error) {
    rmSync(temp, { force: true });
    throw error;
  }
}

export function readOwnership(dir: string): Ownership | undefined {
  try {
    const value = JSON.parse(readFileSync(join(dir, OWNER_FILE), "utf8")) as Partial<Ownership>;
    const strings = (list: unknown): list is string[] => Array.isArray(list) && list.every((item) => typeof item === "string");
    if (typeof value.pid !== "number" || typeof value.repo !== "string" || !strings(value.worktrees) || !strings(value.links)) return undefined;
    return { pid: value.pid, repo: value.repo, worktrees: value.worktrees, links: value.links };
  } catch { return undefined; }
}
