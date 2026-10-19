// PATH handling of the install-dir migration. "reachable" means a new shell finds the nittle dir
// from something persistent: the windows user PATH, or a managed nittle rc block / an rc line that
// already names the dir. the inherited PATH of the process running the migration never counts: it
// can come from a one-off `PATH=... nittle` and says nothing about the next shell.

import { PRODUCT } from "../product";
import { readUserState, writeUserState } from "../userState";
import { fromEnv, TAG, type InstallDirDeps } from "./installDirDeps";
import { hasRcEntryFor, swapRcBlocks } from "./installDirRc";
import { swapUserPath, userPathHas } from "./installDirWinPath";

export function reachable(deps: InstallDirDeps, dir: string): boolean {
  return deps.platform === "win32" ? userPathHas(deps.pathStore, dir) : hasRcEntryFor(deps.home, deps.env, dir);
}

function rewritePath(deps: InstallDirDeps, legacyDir: string, newDir: string, log: (line: string) => void): boolean {
  return deps.platform === "win32"
    ? swapUserPath(deps.pathStore, legacyDir, newDir, log)
    : swapRcBlocks({ home: deps.home, env: deps.env, legacyDir, newDir, log }).length > 0;
}

// swaps the managed diffle PATH entry for the nittle one. true when the nittle dir is reachable afterwards.
// never edits anything but the installer's own entries; otherwise it says what to change by hand.
export function swapPath(deps: InstallDirDeps, legacyDir: string, newDir: string): boolean {
  const log = (line: string) => deps.log(`${TAG} ${line}`);
  const manual = `replace ${legacyDir} with ${newDir} on your PATH (shell profile or user PATH), then run ${PRODUCT.name} again; the ${PRODUCT.legacyName} binary stays until then`;
  if (fromEnv(deps.env, "NO_MODIFY_PATH")) {
    const ok = reachable(deps, newDir);
    if (!ok) log(`${PRODUCT.envPrefix}NO_MODIFY_PATH is set; ${manual}`);
    return ok;
  }
  if (rewritePath(deps, legacyDir, newDir, log) || reachable(deps, newDir)) return true;
  log(`no ${PRODUCT.legacyName} PATH entry managed by the installer was found; ${manual}`);
  return false;
}

// the diffle bin dir is gone but the installer's PATH entry or marker block may still name it. looks
// once per machine (state.json remembers), since reading the windows user PATH spawns powershell.
export function sweepStalePath(deps: InstallDirDeps, legacyDir: string, newDir: string): void {
  try {
    if (readUserState(deps.home).legacyPathChecked) return;
    if (!fromEnv(deps.env, "NO_MODIFY_PATH")) rewritePath(deps, legacyDir, newDir, (line) => deps.log(`${TAG} ${line}`));
    writeUserState({ legacyPathChecked: true }, deps.home);
  } catch { /* the sweep is retried next launch */ }
}
