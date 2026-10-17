// moves ~/.diffle (then ~/.loupe, which 0.28.x kept using in place) into ~/.nittle on first run.
// no ~/.nittle yet and no bin dir: one directory rename, atomic. otherwise a merge (dataDirMerge.ts).
// on any failure both dirs stay, the paths left behind are printed, and the next launch retries.
//
// guards (dataDirGuards.ts): a lock file serializes concurrent launches, the move is deferred while a
// pre-rename mcp server or live session may still write to the old path, and aliased/overlapping
// trees (symlink or junction) are never touched.
//
// bin: the installer's ~/.diffle/bin is owned by the installer cleanup, never moved here. its
// presence forces the per-entry path and keeps ~/.diffle alive; the installer step then calls
// removeEmptyLegacyDirs() once bin is gone.
//
// NITTLE_DATA_DIR / DIFFLE_DATA_DIR: review records live wherever the user pointed, so with a custom
// location only the home-level state (state.json, what userState.ts reads) moves; records are left alone.

import { copyFileSync, existsSync, readdirSync, renameSync, rmdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { productEnv } from "../../utils/env";
import { LEGACY_HOME_DATA_DIRS } from "../dataDir";
import { PRODUCT } from "../product";
import { mergeLegacyDir, SKIPPED_TOP_LEVEL, STATE_FILE, type MergeOps } from "./dataDirMerge";
import { acquireLock, findLiveLegacyWriters, LOCK_NAME, treesOverlap, type WriterCheck } from "./dataDirGuards";
import type { MigrationStep } from "./runner";

export interface DataDirOptions {
  home?: string;
  override?: string; // the data-dir env override; defaults to the real env
  ops?: MergeOps; // injectable so tests can fail the Nth copy
  rename?: (from: string, to: string) => void;
  warn?: (message: string) => void;
  liveWriters?: WriterCheck;
}

const hasSkipped = (dir: string) => [...SKIPPED_TOP_LEVEL].some((name) => existsSync(join(dir, name)));

// removes legacy home dirs that are now empty (after the installer cleared bin). safe to call anytime.
export function removeEmptyLegacyDirs(home = homedir()): void {
  for (const name of LEGACY_HOME_DATA_DIRS) {
    const dir = join(home, name);
    try {
      if (existsSync(dir) && readdirSync(dir).length === 0) rmdirSync(dir);
    } catch { /* not empty or busy: leave it */ }
  }
}

// legacy home dirs still holding data (bin aside): what `doctor` reports as a pending/deferred move.
export function pendingLegacyDataDirs(home = homedir()): string[] {
  return LEGACY_HOME_DATA_DIRS.map((name) => join(home, name)).filter((dir) => {
    try {
      return readdirSync(dir).some((name) => !SKIPPED_TOP_LEVEL.has(name));
    } catch {
      return false;
    }
  });
}

export function createDataDirStep(opts: DataDirOptions = {}): MigrationStep {
  return {
    name: "data-dir",
    run() {
      const home = opts.home ?? homedir();
      const dest = join(home, PRODUCT.dataDir);
      const warn = opts.warn ?? ((m: string) => console.error(m));
      const sources = LEGACY_HOME_DATA_DIRS.map((name) => join(home, name)).filter(existsSync);
      if (sources.length === 0) return;

      const override = opts.override ?? productEnv("DATA_DIR");
      const customRecords = Boolean(override) && resolve(override!) !== resolve(dest);

      let writers: string[];
      try {
        writers = (opts.liveWriters ?? findLiveLegacyWriters)(sources);
      } catch (err) {
        const why = err instanceof Error ? err.message : String(err);
        warn(`data move to ${dest} deferred: could not check for running ${PRODUCT.legacyName} processes (${why}). fix that and relaunch, or run \`${PRODUCT.name} doctor\`.`);
        return "deferred";
      }
      if (writers.length > 0) {
        warn(`data move to ${dest} deferred until these exit: ${writers.join(", ")}`);
        return "deferred";
      }
      const release = acquireLock(join(home, LOCK_NAME));
      if (!release) return "another nittle is migrating; skipped";
      try {
        return migrate(sources, dest, customRecords, opts, warn);
      } finally {
        release();
      }
    },
  };
}

function migrate(sources: string[], dest: string, customRecords: boolean, opts: DataDirOptions, warn: (m: string) => void): string | undefined {
  const ops = opts.ops ?? { copyFile: copyFileSync };
  const rename = opts.rename ?? renameSync;
  const only = customRecords ? [STATE_FILE] : undefined;
  const problems: string[] = [];
  const moved: string[] = [];
  for (const src of sources) {
    if (!existsSync(src)) continue;
    if (treesOverlap(src, dest)) {
      warn(`${src} and ${dest} are the same tree (symlink or nested); leaving both untouched.`);
      continue;
    }
    if (!existsSync(dest) && !customRecords && !hasSkipped(src)) {
      try {
        rename(src, dest);
        moved.push(src);
        continue;
      } catch { /* rename refused (locked, cross-device): fall through to the copy merge */ }
    }
    const { leftover } = mergeLegacyDir(src, dest, ops, only);
    if (leftover.length === 0) moved.push(src);
    else problems.push(...leftover);
  }
  if (problems.length > 0) {
    warn(`could not finish moving old data into ${dest}; nothing was deleted. left behind:\n  ${problems.join("\n  ")}\nit will retry on the next run.`);
    throw new Error(`${problems.length} item(s) left in the old data dir`);
  }
  return moved.length ? `moved ${moved.join(", ")} -> ${dest}` : undefined;
}

export const dataDirStep = createDataDirStep();
