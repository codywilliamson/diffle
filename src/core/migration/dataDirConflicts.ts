// review records that exist in both the old and the new data dir with different content are parked
// here by the data-dir step so the old dir can go away. doctor lists what is parked.

import { readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { PRODUCT } from "../product";

export const CONFLICTS_DIR = "migration-conflicts";

export const conflictsDirFor = (dataDir: string) => join(dataDir, CONFLICTS_DIR);

// the parked records (one dir per review id) under ~/.nittle/migration-conflicts
export function listMigrationConflicts(home = homedir()): string[] {
  const root = conflictsDirFor(join(home, PRODUCT.dataDir));
  try {
    return readdirSync(root).sort().map((name) => join(root, name));
  } catch {
    return [];
  }
}
