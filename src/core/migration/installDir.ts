// last migration step: moves a diffle install (~/.diffle/bin/diffle[.exe], or DIFFLE_INSTALL_DIR)
// to nittle. runs when the transition asset `diffle-<os>-<arch>` (the nittle binary under its old
// name) starts from the diffle install dir, or when any nittle binary finds a diffle install dir
// still on disk. in order: stop legacy mcp servers (they hold the binary open), copy this binary
// to the install dir (installedBinary.ts: NITTLE_INSTALL_DIR, else ~/.nittle/bin), make sure that
// dir is on PATH, then delete the diffle binary and its bin dir. the delete only happens once the
// nittle binary is verified in place AND reachable from PATH, so a failure never leaves a user
// with neither command: the diffle binary stays and the next run retries.
// windows can't delete a running exe: it is renamed aside and a later nittle run removes it.
// cheap when nothing is left: one existsSync on the diffle bin dir.
//
// summary lines go to stderr; stdout may be carrying mcp protocol.

import { existsSync } from "node:fs";
import { join } from "node:path";
import { readUserState, writeUserState } from "../userState";
import { PRODUCT } from "../product";
import { samePath } from "../../utils/pathWithin";
import { findLegacyAgents } from "./agentPlugins";
import { removeEmptyLegacyDirs } from "./dataDir";
import { defaultDeps, TAG, type InstallDirDeps } from "./installDirDeps";
import { clearLegacyInstall, installBinaryCopy, sameBytes } from "./installDirCopy";
import { swapPath, sweepStalePath } from "./installDirPath";
import { plan, type Plan } from "./installDirPlan";
import type { MigrationRecord } from "../../types";
import type { MigrationStep } from "./runner";

export type { InstallDirDeps } from "./installDirDeps";

// agent configs (or plugins) that still launch the diffle binary, as names; empty when all are migrated
function stillLaunchingDiffle(deps: InstallDirDeps): string[] {
  try {
    return findLegacyAgents({ home: deps.home, platform: deps.platform, env: deps.env }).map((finding) => finding.target.displayName);
  } catch {
    return ["an agent config that could not be read"];
  }
}

// phase 1 (runs before the agent step, so agent configs never point at a missing binary): stop the
// legacy mcp servers holding the diffle binary open and copy this binary to the install dir
export function installNittleBinary(overrides: Partial<InstallDirDeps> = {}): string {
  const deps = defaultDeps(overrides);
  const found = plan(deps);
  if (!found || !found.legacyExists) return "";
  if (found.hasBinary) deps.stopServers();
  if (!found.fromLegacyDir) return "";
  const outcome = installBinaryCopy(deps.execPath, found.target, deps.platform);
  const line = `${outcome === "installed" ? "installed" : "already installed:"} ${found.target}`;
  deps.log(`${TAG} ${line}`);
  return line;
}

// phase 2 (last): verify the nittle binary is in place, make sure its dir is on PATH, then delete
// the diffle binary and bin dir
export function removeDiffleInstall(overrides: Partial<InstallDirDeps> = {}): string {
  const deps = defaultDeps(overrides);
  const found = plan(deps);
  if (!found) {
    // a remembered install that is gone by now needs no retry
    const remembered = readUserState(deps.home).migration;
    if (remembered && !existsSync(remembered.legacyDir)) rememberMigration(deps, undefined);
    return "";
  }
  if (!found.legacyExists) {
    // the bin dir is gone; the installer's PATH entry or marker block may still name it
    if (!samePath(found.legacyDir, found.newDir, deps.platform)) sweepStalePath(deps, found.legacyDir, found.newDir);
    if (readUserState(deps.home).migration) rememberMigration(deps, undefined);
    return "";
  }
  let complete = false;
  try {
    const outcome = finishRemoval(deps, found);
    complete = outcome.done;
    return outcome.lines;
  } finally {
    rememberMigration(deps, complete ? undefined : { legacyDir: found.legacyDir, installDir: found.newDir });
  }
}

// persists (or clears) where an unfinished migration will resume; best effort
function rememberMigration(deps: InstallDirDeps, record: MigrationRecord | undefined): void {
  try {
    if (record || readUserState(deps.home).migration) writeUserState({ migration: record }, deps.home);
  } catch { /* the retry just falls back to the env vars and defaults */ }
}

// done = false when work is left for a later run (diffle kept, or a locked exe still to delete)
function finishRemoval(deps: InstallDirDeps, found: Plan): { lines: string; done: boolean } {
  const { platform, home } = deps;
  const { legacyDir, binaryName, hasBinary, newDir, target } = found;
  if (!existsSync(target)) throw new Error(`${target} is missing; keeping the ${PRODUCT.legacyName} install`);
  // phase one may have failed and left a stale file there: the target must be this very binary
  if (found.fromLegacyDir && !sameBytes(deps.execPath, target)) throw new Error(`${target} does not match the running binary; keeping the ${PRODUCT.legacyName} install`);

  // an agent config the earlier step couldn't rewrite (jsonc, odd toml, a missing binary) still launches diffle
  if (hasBinary) {
    const pending = stillLaunchingDiffle(deps);
    if (pending.length > 0) {
      deps.log(`${TAG} ${PRODUCT.legacyName} stays: ${pending.join(", ")} still launch${pending.length === 1 ? "es" : ""} it. run \`${PRODUCT.name} doctor --fix\`, then ${PRODUCT.name} removes it`);
      return { lines: "", done: false };
    }
  }

  // leftovers alone (a windows retry) mean the PATH was already handled by the run that retired the binary
  if (hasBinary && !samePath(legacyDir, newDir, platform) && !swapPath(deps, legacyDir, newDir)) return { lines: "", done: false };

  const lines: string[] = [];
  const say = (line: string) => { deps.log(`${TAG} ${line}`); lines.push(line); };
  const cleanup = clearLegacyInstall(legacyDir, binaryName, platform);
  if (hasBinary && cleanup.removed && !cleanup.deferred.length) say(`removed ${join(legacyDir, binaryName)}`);
  if (cleanup.deferred.length) say(`${cleanup.deferred.join(", ")} is still in use; the next ${PRODUCT.name} run removes it`);
  if (cleanup.dirRemoved) say(`removed ${legacyDir}`);
  removeEmptyLegacyDirs(home);
  return { lines: lines.join("\n"), done: cleanup.deferred.length === 0 };
}

// both phases in one call, for `update` and tests
export function migrateInstallDir(overrides: Partial<InstallDirDeps> = {}): string {
  return [installNittleBinary(overrides), removeDiffleInstall(overrides)].filter(Boolean).join("\n");
}

export function createInstallBinaryStep(overrides: Partial<InstallDirDeps> = {}): MigrationStep {
  return { name: "install-binary", run: () => installNittleBinary(overrides) };
}

export function createInstallDirStep(overrides: Partial<InstallDirDeps> = {}): MigrationStep {
  return { name: "install-dir", run: () => removeDiffleInstall(overrides) };
}

export const installBinaryStep = createInstallBinaryStep();
export const installDirStep = createInstallDirStep();
