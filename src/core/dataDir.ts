// resolves the user data directory. shared by review records, sessions, and user state.

import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { PRODUCT } from "./product";
import { productEnv } from "../utils/env";

// older data dirs, newest first. the startup migration (core/migration/dataDir.ts) moves these into
// ~/.nittle; they only matter here when that migration could not finish.
export const LEGACY_HOME_DATA_DIRS: readonly string[] = [PRODUCT.legacyDataDir, PRODUCT.loupeDataDir];

// ~/.nittle once migrated. if the migration failed before ~/.nittle was created, read the old dir
// for this run so the user still sees their records (the migration retries on the next launch).
// `home` is injectable for tests.
export function homeDataDir(home = homedir()): string {
  const next = join(home, PRODUCT.dataDir);
  if (existsSync(next)) return next;
  const old = LEGACY_HOME_DATA_DIRS.map((name) => join(home, name)).find(existsSync);
  return old ?? next;
}

// NITTLE_DATA_DIR / legacy DIFFLE_DATA_DIR wins; else the resolved home data dir.
export function dataDir(): string {
  return productEnv("DATA_DIR") ?? homeDataDir();
}
