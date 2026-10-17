// runs the one-time legacy-install migrations at cli startup. each step is isolated: a step that
// throws is reported and the rest still run, so a migration bug can never block the cli.

export type MigrationOutcome = string | void;

export interface MigrationStep {
  name: string;
  run(): MigrationOutcome | Promise<MigrationOutcome>;
}

export interface MigrationResult {
  name: string;
  ok: boolean;
  summary: string;
}

export async function runLegacyMigrations(steps: readonly MigrationStep[]): Promise<MigrationResult[]> {
  const results: MigrationResult[] = [];
  for (const step of steps) {
    try {
      results.push({ name: step.name, ok: true, summary: (await step.run()) ?? "" });
    } catch (err) {
      results.push({ name: step.name, ok: false, summary: err instanceof Error ? err.message : String(err) });
    }
  }
  return results;
}
