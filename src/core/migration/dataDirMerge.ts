// merges one legacy data dir into the nittle data dir when both exist. rules: review records merge by
// id (a record already in the destination wins; the source copy is kept in place and reported),
// everything else is carried only when absent, state.json merges key by key with the destination
// winning. nothing is removed from the source until its copy is read back and byte-identical.

import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, rmdirSync, lstatSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { isPidAlive } from "../sessions";
import { treesOverlap } from "./dataDirGuards";

export const REVIEWS_DIR = "reviews";
export const STATE_FILE = "state.json";
// the installer's bin dir lives inside the old data dir; installer cleanup (not data migration) owns it.
export const SKIPPED_TOP_LEVEL = new Set(["bin"]);
const STAGING_MARK = ".migrating-";
const STAGING_PATTERN = /\.migrating-(\d+)$/;
const stagingFor = (to: string) => `${to}${STAGING_MARK}${process.pid}`;

export interface MergeOps {
  copyFile(from: string, to: string): void;
}

export interface MergeReport {
  leftover: string[]; // "<path>: why", for everything still in the source
}

const sameBytes = (a: string, b: string) => readFileSync(a).equals(readFileSync(b));
// lstat everywhere: a symlink or junction is never followed, only reported or removed as a link.
const isLink = (path: string) => lstatSync(path).isSymbolicLink();
const isDir = (path: string) => lstatSync(path).isDirectory();

function filesUnder(root: string, rel = ""): string[] {
  return readdirSync(join(root, rel)).flatMap((name) => {
    const next = join(rel, name);
    if (isLink(join(root, next))) throw new Error(`contains a symlink (${next}); not followed`);
    return isDir(join(root, next)) ? filesUnder(root, next) : [next];
  });
}

function sameTree(a: string, b: string): boolean {
  const files = filesUnder(a);
  const other = new Set(filesUnder(b));
  return files.length === other.size && files.every((f) => other.has(f) && sameBytes(join(a, f), join(b, f)));
}

// copies a file or dir to `<to>.migrating`, verifies it, then renames into place.
function copyVerified(from: string, to: string, ops: MergeOps): void {
  const staging = stagingFor(to);
  rmSync(staging, { recursive: true, force: true });
  try {
    if (isDir(from)) {
      for (const file of filesUnder(from)) {
        mkdirSync(dirname(join(staging, file)), { recursive: true });
        ops.copyFile(join(from, file), join(staging, file));
      }
      if (!sameTree(from, staging)) throw new Error("copy did not match the source");
    } else {
      mkdirSync(dirname(staging), { recursive: true });
      ops.copyFile(from, staging);
      if (!sameBytes(from, staging)) throw new Error("copy did not match the source");
    }
    mkdirSync(dirname(to), { recursive: true });
    renameSync(staging, to);
  } catch (err) {
    rmSync(staging, { recursive: true, force: true });
    throw err;
  }
}

function mergeStateFile(from: string, to: string): void {
  const merged = { ...JSON.parse(readFileSync(from, "utf8")), ...JSON.parse(readFileSync(to, "utf8")) };
  const staging = stagingFor(to);
  writeFileSync(staging, `${JSON.stringify(merged, null, 2)}\n`);
  renameSync(staging, to);
}

// one carry unit: a whole review record dir, or a single file. returns why it stayed, if it did.
function carryUnit(from: string, to: string, isState: boolean, ops: MergeOps): string | null {
  if (isLink(from)) return "is a symlink; left in place";
  const aliased = (existsSync(to) && treesOverlap(from, to)) || treesOverlap(dirname(from), dirname(to));
  if (aliased) return "shares storage with its nittle destination (symlink/junction); left in place";
  if (!existsSync(to)) {
    copyVerified(from, to, ops);
  } else if (isState && !isDir(from)) {
    mergeStateFile(from, to);
  } else if (isDir(from) ? !sameTree(from, to) : !sameBytes(from, to)) {
    return "already exists in nittle with different content (nittle wins; this copy kept here)";
  }
  rmSync(from, { recursive: true });
  return null;
}

function unitsOf(src: string, only?: readonly string[]): { rel: string; isState: boolean }[] {
  const units: { rel: string; isState: boolean }[] = [];
  const walk = (rel: string, depth: number) => {
    for (const name of readdirSync(join(src, rel))) {
      const next = join(rel, name);
      if (depth === 0 && (SKIPPED_TOP_LEVEL.has(name) || (only && !only.includes(name)))) continue;
      const recordDir = rel === REVIEWS_DIR && isDir(join(src, next));
      if (isDir(join(src, next)) && !recordDir) walk(next, depth + 1);
      else units.push({ rel: next, isState: depth === 0 && name === STATE_FILE });
    }
  };
  walk("", 0);
  return units;
}

function pruneEmptyDirs(dir: string): void {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (isDir(path)) pruneEmptyDirs(path);
  }
  if (readdirSync(dir).length === 0) rmdirSync(dir);
}

// `only` limits the merge to those top-level entries (home-level state when records live elsewhere).
// removes staging leftovers from crashed runs, but only when the pid that made them is dead.
function cleanStaleStaging(dir: string, depth = 0): void {
  if (!existsSync(dir) || isLink(dir)) return;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const pid = STAGING_PATTERN.exec(name)?.[1];
    if (pid) {
      if (!isPidAlive(Number(pid))) rmSync(path, { recursive: true, force: true });
    } else if (depth < 1 && isDir(path)) cleanStaleStaging(path, depth + 1);
  }
}

export function mergeLegacyDir(src: string, dest: string, ops: MergeOps, only?: readonly string[]): MergeReport {
  const leftover: string[] = [];
  try { cleanStaleStaging(dest); } catch { /* best-effort */ }
  for (const { rel, isState } of unitsOf(src, only)) {
    try {
      const why = carryUnit(join(src, rel), join(dest, rel), isState, ops);
      if (why) leftover.push(`${join(src, rel)}: ${why}`);
    } catch (err) {
      leftover.push(`${join(src, rel)}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  try {
    if (existsSync(src)) pruneEmptyDirs(src);
  } catch { /* a dir that will not prune stays; the next run retries */ }
  return { leftover };
}
