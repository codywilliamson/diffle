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
import { stopLegacyMcpServers } from "../mcpProcesses";
import { PRODUCT } from "../product";
import { isLegacyProductBinary, isProductBinary } from "../../utils/installRoot";
import { samePath } from "../../utils/pathWithin";
import { removeEmptyLegacyDirs } from "./dataDir";
import { clearLegacyInstall, installBinaryCopy } from "./installDirCopy";
import { hasNittleBlock, swapRcBlocks } from "./installDirRc";
import { defaultUserPathStore, swapUserPath, userPathHas, type UserPathStore } from "./installDirWinPath";
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
  return onPath || (deps.platform === "win32" ? userPathHas(deps.pathStore, dir) : hasNittleBlock(deps.home, deps.env));
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

export function migrateInstallDir(overrides: Partial<InstallDirDeps> = {}): string {
  const deps = defaultDeps(overrides);
  const { platform, home, env, execPath } = deps;
  const legacyDir = env[`${PRODUCT.legacyEnvPrefix}INSTALL_DIR`] ?? join(home, PRODUCT.legacyDataDir, "bin");
  if (!existsSync(legacyDir)) return "";

  const runningName = basename(execPath);
  const fromLegacyDir = isLegacyProductBinary(runningName) && samePath(dirname(execPath), legacyDir, platform);
  if (!fromLegacyDir && !(isProductBinary(runningName) && !isLegacyProductBinary(runningName))) return "";

  const log = (line: string) => deps.log(`${TAG} ${line}`);
  const lines: string[] = [];
  const say = (line: string) => { log(line); lines.push(line); };
  const binaryName = exeName(PRODUCT.legacyName, platform);
  const hasBinary = existsSync(join(legacyDir, binaryName));
  if (hasBinary) deps.stopServers();

  // the transition asset installs itself; a nittle binary is already wherever it was installed
  const newDir = fromLegacyDir ? installDir(home, env) : dirname(execPath);
  const target = fromLegacyDir ? join(newDir, exeName(PRODUCT.name, platform)) : execPath;
  if (fromLegacyDir) say(`${installBinaryCopy(execPath, target, platform) === "installed" ? "installed" : "already installed:"} ${target}`);
  if (!existsSync(target)) throw new Error(`${target} is missing; keeping the ${PRODUCT.legacyName} install`);

  // leftovers alone (a windows retry) mean the PATH was already handled by the run that retired the binary
  const sameDir = samePath(legacyDir, newDir, platform);
  if (hasBinary && !sameDir && !swapPath(deps, legacyDir, newDir)) return lines.join("\n");

  const cleanup = clearLegacyInstall(legacyDir, binaryName, platform);
  if (hasBinary && cleanup.removed && !cleanup.deferred.length) say(`removed ${join(legacyDir, binaryName)}`);
  if (cleanup.deferred.length) say(`${cleanup.deferred.join(", ")} is still in use; the next ${PRODUCT.name} run removes it`);
  if (cleanup.dirRemoved) say(`removed ${legacyDir}`);
  removeEmptyLegacyDirs(home);
  return lines.join("\n");
}

export function createInstallDirStep(overrides: Partial<InstallDirDeps> = {}): MigrationStep {
  return { name: "install-dir", run: () => migrateInstallDir(overrides) };
}

export const installDirStep = createInstallDirStep();
