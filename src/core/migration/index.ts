// ordered legacy-install migrations. each slice adds one step file and appends it here.

import { basename } from "node:path";
import { createAgentPluginsStep } from "./agentPlugins";
import type { MigrationStep } from "./runner";
import { isProductBinary } from "../../utils/installRoot";

export { runLegacyMigrations } from "./runner";
export type { MigrationResult, MigrationStep } from "./runner";

export const LEGACY_MIGRATION_STEPS: readonly MigrationStep[] = [createAgentPluginsStep()];

// migrations rewrite real installs (data dir, agent configs, PATH), so they only run from a
// compiled product binary. `bun src/index.ts` (dev, tests, e2e) never migrates the developer's home.
export function shouldRunLegacyMigrations(execPath = process.execPath): boolean {
  return isProductBinary(basename(execPath));
}
