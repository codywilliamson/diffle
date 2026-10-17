// resolves the user data directory. shared by review records, sessions, and user state.

import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { PRODUCT } from "./product";
import { productEnv } from "../utils/env";

// the product data dir for new users; an existing legacy dir (with no new one) is kept in place so an
// upgrade never strands records — never copied or deleted. `home` is injectable for tests.
export function homeDataDir(home = homedir()): string {
  const next = join(home, PRODUCT.dataDir);
  const legacy = join(home, PRODUCT.legacyDataDir);
  return !existsSync(next) && existsSync(legacy) ? legacy : next;
}

// NITTLE_DATA_DIR / legacy DIFFLE_DATA_DIR wins; else the resolved home data dir.
export function dataDir(): string {
  return productEnv("DATA_DIR") ?? homeDataDir();
}
