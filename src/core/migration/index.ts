// ordered legacy-install migrations. each slice adds one step file and appends it here.

import type { MigrationStep } from "./runner";
import { dataDirStep } from "./dataDir";
import { legacyEnvStep } from "./legacyEnv";

export { runLegacyMigrations } from "./runner";
export type { MigrationResult, MigrationStep } from "./runner";

// data dir first: the env notice persists its "already shown" flag into the migrated ~/.nittle.
export const LEGACY_MIGRATION_STEPS: readonly MigrationStep[] = [dataDirStep, legacyEnvStep];
