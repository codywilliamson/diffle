// checks loupe's own repo for a newer release tag on origin. throttled git fetch,
// pure semver comparison. used by GET /api/update; the ui shows pull instructions.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { UpdateStatus } from "../types";
import { runGit } from "../utils/git";
import { injectedVersion } from "./standalone";

const FETCH_INTERVAL_MS = 10 * 60 * 1000; // throttle the network fetch to once per 10 min
let lastFetch = 0;

// parse "1.2.3" or "v1.2.3" into [major, minor, patch]; non-semver tags ⇒ null.
function parseSemver(tag: string): Semver | null {
  const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(tag.trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

type Semver = [number, number, number];

function cmp(a: Semver, b: Semver): number {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

// highest semver among `tags` that exceeds `current`, else `current` unchanged.
export function latestVersion(current: string, tags: string[]): string {
  let bestParts: Semver = parseSemver(current) ?? [0, 0, 0];
  let best = current;
  for (const tag of tags) {
    const parts = parseSemver(tag);
    if (parts && cmp(parts, bestParts) > 0) {
      bestParts = parts;
      best = parts.join(".");
    }
  }
  return best;
}

// installed version (also used by the cli banner): the build-time constant in the standalone
// binary, else loupe's own package.json in a source checkout.
export function currentVersion(loupeRoot: string): string {
  const injected = injectedVersion();
  if (injected) return injected;
  try {
    const pkg = JSON.parse(readFileSync(join(loupeRoot, "package.json"), "utf8"));
    return String(pkg.version ?? "0.0.0");
  } catch {
    return "0.0.0";
  }
}

// fetches origin tags (throttled, best-effort) and compares them to the installed version.
export function checkForUpdate(loupeRoot: string): UpdateStatus {
  const current = currentVersion(loupeRoot);
  const now = Date.now();
  if (now - lastFetch > FETCH_INTERVAL_MS) {
    lastFetch = now;
    try {
      runGit(["fetch", "--tags", "--quiet"], loupeRoot);
    } catch {
      // offline or no remote: fall back to whatever tags are already local
    }
  }
  let tags: string[] = [];
  try {
    tags = runGit(["tag", "--list"], loupeRoot)
      .split("\n")
      .map((t) => t.trim())
      .filter(Boolean);
  } catch {
    // not a git checkout: report up to date
  }
  const latest = latestVersion(current, tags);
  return { behind: latest !== current, current, latest, repoPath: loupeRoot };
}
