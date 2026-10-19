// where a release's assets live and what their checksums are. shared by the npm, brew and scoop renderers.

import { PRODUCT } from "../../src/core/product";
import { assetName, parseChecksum } from "../../src/core/updateTarget";

export function cleanVersion(raw: string): string {
  return raw.replace(/^v/, "");
}

export function releaseBaseUrl(version: string): string {
  return `${PRODUCT.repository}/releases/download/v${cleanVersion(version)}`;
}

export function assetUrl(version: string, target: string): string {
  return `${releaseBaseUrl(version)}/${assetName(target)}`;
}

// sha-256 of a target's binary from a checksums.txt body; a missing entry is a broken release, so it throws.
export function sha256For(checksums: string, target: string): string {
  const sha = parseChecksum(checksums, assetName(target));
  if (!sha) throw new Error(`checksums.txt has no entry for ${assetName(target)}`);
  return sha;
}
