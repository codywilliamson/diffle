// the transition release assets: `diffle-<os>-<arch>[.exe]` copies of the nittle binary, so a
// 0.28.x `diffle update` (which only knows the old asset name) still finds something to download.
// the copy runs from a diffle install dir, installs itself under the nittle name and removes the
// diffle leftovers (core/migration/installDir.ts).
//
// the window is time based: every release carries the copies until TRANSITION_ASSETS_UNTIL. a
// release count broke on 2026-10-28: 0.29.0 to 0.32.0 shipped within a day, used up the window and
// left every 0.28.x updater without an asset. when the cutoff nears, extend it or record the
// decision in TRANSITION_CUTOFF_DECISION (a test fails inside TRANSITION_CUTOFF_WARN_DAYS).
// when it passes, drop the diffle asset lines from release.yml's smoke steps too.

import { PRODUCT } from "./product";

export const RENAME_BASE_VERSION = "0.28.1"; // the last release published under the diffle name
// six months after the rename shipped on 2026-10-20; 0.28.x installs need that long to be seen again.
// the window is open before this instant (utc midnight) and closed from it on
export const TRANSITION_ASSETS_UNTIL = "2027-04-20";
export const TRANSITION_CUTOFF_WARN_DAYS = 30;
// null until someone decides what happens at the cutoff ("let it lapse on <date>: <why>"); the
// guard test accepts any text here, so write the reason down
export const TRANSITION_CUTOFF_DECISION: string | null = null;

const DAY_MS = 86_400_000;

export type SmokeDecision = "run" | "skip" | "fail";

type Semver = [number, number, number];

function parse(tag: string): Semver | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(tag.trim());
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

function isNewer(a: Semver, b: Semver): boolean {
  return a[0] !== b[0] ? a[0] > b[0] : a[1] !== b[1] ? a[1] > b[1] : a[2] > b[2];
}

// the diffle-named twin of a nittle asset: nittle-linux-x64 -> diffle-linux-x64
export const transitionAssetName = (asset: string): string => asset.replace(PRODUCT.name, PRODUCT.legacyName);

export const isTransitionWindowOpen = (now: Date): boolean => now.getTime() < Date.parse(TRANSITION_ASSETS_UNTIL);

// whole days from `now` to the cutoff (negative once it has passed)
export const daysUntilCutoff = (now: Date): number => Math.ceil((Date.parse(TRANSITION_ASSETS_UNTIL) - now.getTime()) / DAY_MS);

// true when a release of `version` built at `now` publishes the diffle copies. pre-rename versions
// are never rebuilt, so they stay on the safe side and carry them.
export function carriesTransitionAssets(version: string, now: Date): boolean {
  const current = parse(version);
  if (!current || !isNewer(current, parse(RENAME_BASE_VERSION)!)) return true;
  return isTransitionWindowOpen(now);
}

// upgrade-smoke's live check: inside the window a latest release without the copies is the
// regression this module exists to prevent, so it fails; after the cutoff it skips.
export function liveSmokeDecision(latestHasLegacyAssets: boolean, now: Date): SmokeDecision {
  if (latestHasLegacyAssets) return "run";
  return isTransitionWindowOpen(now) ? "fail" : "skip";
}
