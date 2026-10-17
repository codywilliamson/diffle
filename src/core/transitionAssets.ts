// the transition release assets: `diffle-<os>-<arch>[.exe]` copies of the nittle binary, so a
// 0.28.x `diffle update` (which only knows the old asset name) still finds something to download.
// the copy runs from a diffle install dir, installs itself under the nittle name and removes the
// diffle leftovers (core/migration/installDir.ts).
//
// publishing stops after TRANSITION_ASSET_RELEASES releases newer than RENAME_BASE_VERSION: the
// first nittle release and the next two carry the copies, the fourth does not. when that
// happens, drop the diffle asset lines from release.yml's smoke steps too.

import { PRODUCT } from "./product";

export const RENAME_BASE_VERSION = "0.28.1"; // the last release published under the diffle name
export const TRANSITION_ASSET_RELEASES = 3;

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

// true while `version` is one of the first TRANSITION_ASSET_RELEASES releases after the rename.
// `tags` are the existing release tags; the release being built may or may not be among them.
export function carriesTransitionAssets(version: string, tags: readonly string[]): boolean {
  const base = parse(RENAME_BASE_VERSION)!;
  const current = parse(version);
  if (!current || !isNewer(current, base)) return true;
  const earlier = tags
    .map(parse)
    .filter((tag): tag is Semver => tag !== null && isNewer(tag, base) && isNewer(current, tag));
  return earlier.length < TRANSITION_ASSET_RELEASES;
}
