// the upgrade step itself. simulated mode does exactly what the 0.28.1 updater does after it has
// downloaded the transition asset (update.ts replaceBinary: staged write, then on windows retire the
// running exe aside and rename the staged file into place); live mode runs the real `diffle update`.
// both end with the next step the updater prints: `diffle --version`.

import { chmodSync, copyFileSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { retireBinary } from "../../src/core/retireBinary";
import { platformTarget } from "../../src/core/updateTarget";
import { transitionAssetName } from "../../src/core/transitionAssets";
import { EXE, pathWith, run, WINDOWS, type RunResult, type Sandbox } from "./sandbox";

// a diffle env var on purpose: the migration should notice it once
export const LEGACY_ENV = { DIFFLE_NO_UPDATE_CHECK: "1" };

export function simulateOldUpdater(target: string, nittleBinary: string, workDir: string): string {
  const asset = join(workDir, transitionAssetName(`nittle-${platformTarget()}${EXE}`));
  copyFileSync(nittleBinary, asset); // the release publishes the nittle binary under the diffle asset name
  const staged = join(dirname(target), `.diffle${EXE}.new`);
  copyFileSync(asset, staged);
  if (WINDOWS) retireBinary(target);
  else chmodSync(staged, 0o755);
  renameSync(staged, target);
  return asset;
}

export function liveOldUpdater(box: Sandbox, target: string): RunResult {
  return run(target, ["update"], box.env({ ...LEGACY_ENV, ...(process.env.GITHUB_TOKEN ? { GITHUB_TOKEN: process.env.GITHUB_TOKEN } : {}) }), box.home);
}

// "confirm the new version in a new shell: `diffle --version`", run from the shell that still has the old PATH
export function printedNextStep(box: Sandbox, target: string): RunResult {
  const env = box.env({ ...LEGACY_ENV, PATH: pathWith(dirname(target), box.cleanPath) });
  return run(target, ["--version"], env, box.home);
}
