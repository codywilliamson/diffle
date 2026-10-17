// ordered legacy-install migrations. each slice adds one step file and appends it here.

import type { MigrationStep } from "./runner";

export { runLegacyMigrations } from "./runner";
export type { MigrationResult, MigrationStep } from "./runner";

export const LEGACY_MIGRATION_STEPS: readonly MigrationStep[] = [];
