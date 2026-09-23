// build-time injection point for the standalone binary. the generated entry
// (scripts/build-binary.ts) calls useStandaloneBuild once before the cli runs;
// every other mode (source, dev, preview, tests) uses the defaults below.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { directoryAssets, type AssetSource } from "../server/assetSource";

interface StandaloneBuild {
  version: string;
  licenseText: string;
  assets: AssetSource;
}

let build: StandaloneBuild | null = null;

export function useStandaloneBuild(next: StandaloneBuild): void {
  build = next;
}

// injected build version, or null in source/preview mode (caller falls back to package.json).
export function injectedVersion(): string | null {
  return build?.version ?? null;
}

export function resolveLicenseText(loupeRoot: string): string {
  return build?.licenseText ?? readFileSync(join(loupeRoot, "LICENSE"), "utf8");
}

// embedded client assets in the binary, or a directory adapter over dist/client otherwise.
export function resolveClientAssets(loupeRoot: string): AssetSource {
  return build?.assets ?? directoryAssets(join(loupeRoot, "dist", "client"));
}
