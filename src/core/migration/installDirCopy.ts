// file helpers for the install-dir migration: copy the running binary into the nittle bin dir
// (staged write, chmod, rename, hash verify) and clear the diffle install dir.

import { createHash } from "node:crypto";
import { chmodSync, copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmdirSync, rmSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { PRODUCT } from "../product";
import { retireBinary } from "../retireBinary";

const sha256 = (file: string) => createHash("sha256").update(readFileSync(file)).digest("hex");
const EXECUTABLE = 0o755;

// "installed" | "unchanged" (the target already holds identical bytes). throws, leaving the
// target as it was, when the copy can't be verified.
export function installBinaryCopy(source: string, target: string, platform: NodeJS.Platform): "installed" | "unchanged" {
  const expected = sha256(source);
  if (existsSync(target) && sha256(target) === expected) return "unchanged";
  mkdirSync(dirname(target), { recursive: true });
  const staged = join(dirname(target), `.${basename(target)}.new-${process.pid}`);
  try {
    copyFileSync(source, staged);
    chmodSync(staged, EXECUTABLE);
    // windows can rename a running exe but not overwrite it; unix rename replaces atomically
    if (platform === "win32" && existsSync(target)) retireBinary(target);
    renameSync(staged, target);
  } finally {
    rmSync(staged, { force: true });
  }
  if (sha256(target) !== expected) throw new Error(`${target} does not match the running binary after the copy`);
  return "installed";
}

export interface LegacyCleanup {
  removed: boolean; // the diffle binary is gone
  deferred: string[]; // leftovers a running process still holds (windows)
  dirRemoved: boolean;
}

// retired and staged leftovers all start with ".diffle" (.diffle.exe.old, .diffle.new-123)
const isLeftover = (name: string) => name.startsWith(`.${PRODUCT.legacyName}`);

// removes the diffle binary and its leftovers, then the bin dir if that leaves it empty.
// a running exe can't be deleted on windows: it is renamed aside and the next run retries.
export function clearLegacyInstall(legacyDir: string, binaryName: string, platform: NodeJS.Platform): LegacyCleanup {
  const binary = join(legacyDir, binaryName);
  const deferred: string[] = [];
  if (existsSync(binary)) {
    try {
      if (platform === "win32") retireBinary(binary);
      else rmSync(binary);
    } catch {
      deferred.push(binary);
    }
  }
  for (const name of readdirSync(legacyDir).filter(isLeftover)) {
    try { rmSync(join(legacyDir, name), { force: true }); } catch { deferred.push(join(legacyDir, name)); }
  }
  const removed = !existsSync(binary);
  let dirRemoved = false;
  try {
    if (readdirSync(legacyDir).length === 0) {
      rmdirSync(legacyDir);
      dirRemoved = true;
    }
  } catch { /* busy */ }
  return { removed, deferred, dirRemoved };
}
