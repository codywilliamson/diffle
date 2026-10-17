// last migration step: moves a diffle install (~/.diffle/bin/diffle[.exe], or DIFFLE_INSTALL_DIR)
// to nittle. runs when the transition asset `diffle-<os>-<arch>` (the nittle binary under its old
// name) starts from the diffle install dir, or when any nittle binary finds a diffle install dir
// still on disk. in order: stop legacy mcp servers (they hold the binary open), copy this binary
// to ~/.nittle/bin (NITTLE_INSTALL_DIR), swap the PATH entry, then delete the diffle binary and
// its bin dir. the PATH swap happens before the delete, so a failure keeps the diffle binary.
// windows can't delete a running exe: it is renamed aside and a later nittle run removes it.
// cheap when nothing is left: one existsSync on the diffle bin dir.
//
// summary lines go to stderr; stdout may be carrying mcp protocol.

import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { installedBinaryPath } from "../installedBinary";
import { stopLegacyMcpServers } from "../mcpProcesses";
import { PRODUCT } from "../product";
import { isLegacyProductBinary, isProductBinary } from "../../utils/installRoot";
import { removeEmptyLegacyDirs } from "./dataDir";
import { clearLegacyInstall, installBinaryCopy } from "./installDirCopy";
import { swapRcBlocks } from "./installDirRc";
import { defaultUserPathStore, swapUserPath, type UserPathStore } from "./installDirWinPath";
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

function samePath(a: string, b: string, platform: NodeJS.Platform): boolean {
  const fold = (path: string) => (platform === "win32" ? resolve(path).toLowerCase() : resolve(path));
  return fold(a) === fold(b);
}

function defaultDeps(overrides: Partial<InstallDirDeps>): InstallDirDeps {
  const env = overrides.env ?? process.env;
  return {
    home: homedir(), platform: process.platform, execPath: process.execPath, env,
    pathStore: defaultUserPathStore(env), stopServers: stopLegacyMcpServers, log: (line) => console.error(line),
    ...overrides,
  };
}

function swapPath(deps: InstallDirDeps, legacyDir: string, newDir: string): void {
  const log = (line: string) => deps.log(`${TAG} ${line}`);
  if (fromEnv(deps.env, "NO_MODIFY_PATH")) return log(`${PRODUCT.envPrefix}NO_MODIFY_PATH is set; replace ${legacyDir} with ${newDir} on your PATH yourself`);
  const changed = deps.platform === "win32"
    ? swapUserPath(deps.pathStore, legacyDir, newDir, log)
    : swapRcBlocks({ home: deps.home, env: deps.env, legacyDir, newDir, log }).length > 0;
  if (!changed) log(`no ${PRODUCT.legacyName} PATH entry found to rewrite; if you added it by hand, replace ${legacyDir} with ${newDir} in your shell profile`);
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
  const configured = env[`${PRODUCT.envPrefix}INSTALL_DIR`];
  const newDir = fromLegacyDir ? configured ?? dirname(installedBinaryPath(home, platform)) : dirname(execPath);
  if (fromLegacyDir) {
    const target = join(newDir, exeName(PRODUCT.name, platform));
    say(`${installBinaryCopy(execPath, target, platform) === "installed" ? "installed" : "already installed:"} ${target}`);
  }
  // leftovers alone (a windows retry) mean the PATH was already handled by the run that retired the binary
  if (hasBinary && !samePath(legacyDir, newDir, platform)) swapPath(deps, legacyDir, newDir);

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
