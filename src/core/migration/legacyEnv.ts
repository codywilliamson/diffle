// one-time stderr notice naming each DIFFLE_* var to rename. "already noticed" is persisted in the
// nittle user state keyed by the var set, so it shows once per set and again only if the set changes.
// shell profiles are never touched.

import { legacyEnvRenames } from "../../utils/env";
import { readUserState, writeUserState } from "../userState";
import type { MigrationStep } from "./runner";

export interface LegacyEnvOptions {
  env?: NodeJS.ProcessEnv;
  home?: string;
  warn?: (message: string) => void;
}

export function createLegacyEnvStep(opts: LegacyEnvOptions = {}): MigrationStep {
  return {
    name: "legacy-env-notice",
    run() {
      const renames = legacyEnvRenames(opts.env);
      if (renames.length === 0) return;
      const key = renames.join(",");
      if (readUserState(opts.home).legacyEnvNoticed === key) return;
      const warn = opts.warn ?? ((message: string) => console.error(message));
      warn(`DIFFLE_* environment variables are deprecated; rename them (still read for now):\n  ${renames.join("\n  ")}`);
      writeUserState({ legacyEnvNoticed: key }, opts.home);
      return `noticed ${renames.length} legacy var(s)`;
    },
  };
}

export const legacyEnvStep = createLegacyEnvStep();
