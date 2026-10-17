// ordered legacy-install migrations. each slice adds one step file and appends it here.

import { basename } from "node:path";
import { createAgentPluginsStep } from "./agentPlugins";
import type { MigrationStep } from "./runner";
import { isProductBinary } from "../../utils/installRoot";
import { dataDirStep } from "./dataDir";
import { legacyEnvStep } from "./legacyEnv";

export { runLegacyMigrations } from "./runner";
export type { MigrationResult, MigrationStep } from "./runner";

// data dir first: the env notice persists its "already shown" flag into the migrated ~/.nittle.
export const LEGACY_MIGRATION_STEPS: readonly MigrationStep[] = [dataDirStep, legacyEnvStep, createAgentPluginsStep()];

// migrations rewrite real installs (data dir, agent configs, PATH), so they only run from a
// compiled product binary. `bun src/index.ts` (dev, tests, e2e) never migrates the developer's home.
export function shouldRunLegacyMigrations(execPath = process.execPath): boolean {
  return isProductBinary(basename(execPath));
}
