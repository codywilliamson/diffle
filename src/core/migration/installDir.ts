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
import { homedir } from "node:os";
import { basename, delimiter, dirname, join } from "node:path";
import { installDir } from "../installedBinary";
import { readUserState, writeUserState } from "../userState";
import { detectPackageManager } from "../updateTarget";
import { stopLegacyMcpServers } from "../mcpProcesses";
import { PRODUCT } from "../product";
import { samePath } from "../../utils/pathWithin";
import { findLegacyAgents } from "./agentPlugins";
import { removeEmptyLegacyDirs } from "./dataDir";
import { clearLegacyInstall, installBinaryCopy, sameBytes } from "./installDirCopy";
import { hasNittleBlock, swapRcBlocks } from "./installDirRc";
import { defaultUserPathStore, swapUserPath, userPathHas, type UserPathStore } from "./installDirWinPath";
import type { MigrationRecord } from "../../types";
import type { MigrationStep } from "./runner";

export interface InstallDirDeps {
  home: string;
  platform: NodeJS.Platform;
  execPath: string;
  env: NodeJS.ProcessEnv;
  pathStore: UserPathStore; // windows user PATH
  stopServers: () => unknown;
  log: (line: string) => void;
}

const TAG = `[${PRODUCT.name}]`;
const exeName = (name: string, platform: NodeJS.Platform) => (platform === "win32" ? `${name}.exe` : name);
const fromEnv = (env: NodeJS.ProcessEnv, name: string) => env[PRODUCT.envPrefix + name] ?? env[PRODUCT.legacyEnvPrefix + name];

function defaultDeps(overrides: Partial<InstallDirDeps>): InstallDirDeps {
  const env = overrides.env ?? process.env;
  return {
    home: homedir(), platform: process.platform, execPath: process.execPath, env,
    pathStore: defaultUserPathStore(env), stopServers: stopLegacyMcpServers, log: (line) => console.error(line),
    ...overrides,
  };
}

// is `dir` already reachable from a new shell: on this process's PATH, in the user PATH (windows),
// or behind a nittle block in an rc file (unix)
function reachable(deps: InstallDirDeps, dir: string): boolean {
  const separator = deps.platform === "win32" ? ";" : delimiter; // non-win32 only differs from the host in tests
  const onPath = (deps.env.PATH ?? deps.env.Path ?? "").split(separator).some((entry) => entry !== "" && samePath(entry, dir, deps.platform));
  return onPath || (deps.platform === "win32" ? userPathHas(deps.pathStore, dir) : hasNittleBlock(deps.home, deps.env, dir));
}

// swaps the managed diffle PATH entry for the nittle one. true when the nittle dir is reachable afterwards.
// never edits anything but the installer's own entries; otherwise it says what to change by hand.
function swapPath(deps: InstallDirDeps, legacyDir: string, newDir: string): boolean {
  const log = (line: string) => deps.log(`${TAG} ${line}`);
  const manual = `replace ${legacyDir} with ${newDir} on your PATH (shell profile or user PATH), then run ${PRODUCT.name} again; the ${PRODUCT.legacyName} binary stays until then`;
  if (fromEnv(deps.env, "NO_MODIFY_PATH")) {
    const ok = reachable(deps, newDir);
    if (!ok) log(`${PRODUCT.envPrefix}NO_MODIFY_PATH is set; ${manual}`);
    return ok;
  }
  const changed = deps.platform === "win32"
    ? swapUserPath(deps.pathStore, legacyDir, newDir, log)
    : swapRcBlocks({ home: deps.home, env: deps.env, legacyDir, newDir, log }).length > 0;
  if (changed || reachable(deps, newDir)) return true;
  log(`no ${PRODUCT.legacyName} PATH entry managed by the installer was found; ${manual}`);
  return false;
}


interface Plan {
  legacyDir: string;
  binaryName: string;
  hasBinary: boolean;
  fromLegacyDir: boolean; // the running binary is the diffle install being retired
  newDir: string;
  target: string; // the nittle binary the install is moving to (or already is)
}

// the executable's name without extension, when it is exactly `name` (so not nittle-mcp, diffle-linux-x64...)
const isNamed = (execPath: string, name: string) => basename(execPath).replace(/\.exe$/i, "").toLowerCase() === name;

// what to do for this run, or null when there is no diffle install to move. only an installed copy
// of exactly `diffle` (not a package-manager one) or `nittle` (running from the install dir) qualifies;
// MCPB servers (nittle-mcp) and binaries run from anywhere else never migrate and never become the
// destination. a `diffle` binary is the install itself wherever it lives, so a 0.28.x install made
// once with DIFFLE_INSTALL_DIR=/custom is found without the variable. a nittle run is told where the
// diffle install is by the installers (NITTLE_LEGACY_INSTALL_DIR) or the old DIFFLE_INSTALL_DIR.
function plan(deps: InstallDirDeps): Plan | null {
  const { platform, home, env, execPath } = deps;
  const fromLegacyDir = isNamed(execPath, PRODUCT.legacyName) && !detectPackageManager(execPath);
  const installedNittle = isNamed(execPath, PRODUCT.name) && !detectPackageManager(execPath) && samePath(dirname(execPath), installDir(home, env), platform);
  if (!fromLegacyDir && !installedNittle) return null;
  const legacyDir = fromLegacyDir ? dirname(execPath) : env[`${PRODUCT.envPrefix}LEGACY_INSTALL_DIR`] ?? env[`${PRODUCT.legacyEnvPrefix}INSTALL_DIR`] ?? readUserState(home).migration?.legacyDir ?? join(home, PRODUCT.legacyDataDir, "bin");
  if (!existsSync(legacyDir)) return null;

  // the transition asset installs itself; an installed nittle is already in place
  const newDir = fromLegacyDir ? installDir(home, env) : dirname(execPath);
  const binaryName = exeName(PRODUCT.legacyName, platform);
  return {
    legacyDir, binaryName, fromLegacyDir, newDir,
    hasBinary: existsSync(join(legacyDir, binaryName)),
    target: fromLegacyDir ? join(newDir, exeName(PRODUCT.name, platform)) : execPath,
  };
}

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
  if (!found) return "";
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
