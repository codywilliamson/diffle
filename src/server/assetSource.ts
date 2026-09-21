// one seam for serving the built client: a directory adapter for source/preview mode,
// and an embedded-file adapter for the standalone binary (a generated import map).

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { insideDir } from "../utils/pathWithin";

export interface AssetSource {
  // client-relative path (leading slash stripped, ".." already refused) → bytes, or null when absent.
  read(rel: string): Uint8Array | null;
}

// reads the built client live from disk (source + preview mode).
export function directoryAssets(clientDir: string): AssetSource {
  return {
    read(rel) {
      if (!insideDir(clientDir, rel)) return null;
      const filePath = resolve(clientDir, rel);
      return existsSync(filePath) ? readFileSync(filePath) : null;
    },
  };
}

// serves files embedded in the standalone binary. `files` maps each client path to its build-time
// `with { type: "file" }` import — a real disk path in dev, a virtual bunfs path once compiled.
export function embeddedAssets(files: Record<string, string>): AssetSource {
  return {
    read(rel) {
      const file = files[rel];
      return file ? readFileSync(file) : null;
    },
  };
}
