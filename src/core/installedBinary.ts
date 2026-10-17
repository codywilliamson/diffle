// where the installers put the nittle binary: NITTLE_INSTALL_DIR, else the deprecated
// DIFFLE_INSTALL_DIR (the installers fall back to it), else ~/.nittle/bin. the install-dir migration,
// serverCommand and setup all resolve it here, so agent configs and the copied binary agree.

import { homedir } from "node:os";
import { join } from "node:path";
import { PRODUCT } from "./product";
import { readUserState } from "./userState";

// an unfinished migration remembers the dir it chose (state.json), so a retry without the env vars
// lands in the same place
export function installDir(home = homedir(), env: NodeJS.ProcessEnv = process.env): string {
  return env[`${PRODUCT.envPrefix}INSTALL_DIR`] || env[`${PRODUCT.legacyEnvPrefix}INSTALL_DIR`] || readUserState(home).migration?.installDir || join(home, PRODUCT.dataDir, "bin");
}

export function installedBinaryPath(home = homedir(), platform: NodeJS.Platform = process.platform, env: NodeJS.ProcessEnv = process.env): string {
  return join(installDir(home, env), platform === "win32" ? `${PRODUCT.name}.exe` : PRODUCT.name);
}
