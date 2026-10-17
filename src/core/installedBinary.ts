// where the installers put the nittle binary: ~/.nittle/bin/nittle(.exe). setup and the legacy
// migration write this path (not whatever executable happens to be running) into agent configs.

import { homedir } from "node:os";
import { join } from "node:path";
import { PRODUCT } from "./product";

export function installedBinaryPath(home = homedir(), platform: NodeJS.Platform = process.platform): string {
  return join(home, PRODUCT.dataDir, "bin", platform === "win32" ? `${PRODUCT.name}.exe` : PRODUCT.name);
}
