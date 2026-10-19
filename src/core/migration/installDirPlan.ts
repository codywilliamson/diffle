// decides what the install-dir migration has to do on this run, from the running executable and the env.

import { existsSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { installDir } from "../installedBinary";
import { detectPackageManager } from "../updateTarget";
import { PRODUCT } from "../product";
import { readUserState } from "../userState";
import { samePath } from "../../utils/pathWithin";
import { exeName, type InstallDirDeps } from "./installDirDeps";

export interface Plan {
  legacyDir: string;
  binaryName: string;
  hasBinary: boolean;
  legacyExists: boolean; // false once the diffle bin dir is gone (its PATH entry may linger)
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
export function plan(deps: InstallDirDeps): Plan | null {
  const { platform, home, env, execPath } = deps;
  const fromLegacyDir = isNamed(execPath, PRODUCT.legacyName) && !detectPackageManager(execPath);
  const installedNittle = isNamed(execPath, PRODUCT.name) && !detectPackageManager(execPath) && samePath(dirname(execPath), installDir(home, env), platform);
  if (!fromLegacyDir && !installedNittle) return null;
  const legacyDir = fromLegacyDir ? dirname(execPath) : env[`${PRODUCT.envPrefix}LEGACY_INSTALL_DIR`] ?? env[`${PRODUCT.legacyEnvPrefix}INSTALL_DIR`] ?? readUserState(home).migration?.legacyDir ?? join(home, PRODUCT.legacyDataDir, "bin");
  const legacyExists = existsSync(legacyDir);
  if (!legacyExists && fromLegacyDir) return null;

  // the transition asset installs itself; an installed nittle is already in place
  const newDir = fromLegacyDir ? installDir(home, env) : dirname(execPath);
  const binaryName = exeName(PRODUCT.legacyName, platform);
  return {
    legacyDir, binaryName, fromLegacyDir, legacyExists, newDir,
    hasBinary: existsSync(join(legacyDir, binaryName)),
    target: fromLegacyDir ? join(newDir, exeName(PRODUCT.name, platform)) : execPath,
  };
}
