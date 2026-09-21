// checks the GitHub Releases channel for a newer diffle than the one running. best-effort and
// throttled; any network failure reports "up to date" so the ui never blocks or errors offline.
// the installed version is the build-time constant (standalone binary) or package.json (source).

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { UpdateStatus } from "../types";
import { PRODUCT } from "./product";
import { injectedVersion } from "./standalone";

const CACHE_MS = 10 * 60 * 1000; // reuse a result for 10 min to stay under the API rate limit
const FETCH_TIMEOUT_MS = 3000;
let cache: { at: number; status: UpdateStatus } | null = null;

type Semver = [number, number, number];

// parse "1.2.3" or "v1.2.3" into [major, minor, patch]; non-semver tags ⇒ null.
function parseSemver(tag: string): Semver | null {
  const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(tag.trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

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

// installed version: the build-time constant in the standalone binary, else package.json.
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

// owner/repo from the configured repository url → the releases api endpoint.
export function releasesApiUrl(): string {
  const m = /github\.com\/([^/]+)\/([^/.]+)/.exec(PRODUCT.repository);
  const [, owner = "", repo = ""] = m ?? [];
  return `https://api.github.com/repos/${owner}/${repo}/releases?per_page=20`;
}

// published (non-draft, non-prerelease) release tags; [] on any network/parse failure.
async function fetchReleaseTags(): Promise<string[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(releasesApiUrl(), {
      headers: { Accept: "application/vnd.github+json", "User-Agent": PRODUCT.name },
      signal: controller.signal,
    });
    if (!res.ok) return [];
    const releases = (await res.json()) as Array<{ tag_name?: string; draft?: boolean; prerelease?: boolean }>;
    return releases.filter((r) => !r.draft && !r.prerelease && r.tag_name).map((r) => r.tag_name as string);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

// current install vs the newest published release. `fetchTags` is injectable for tests.
export async function checkForUpdate(loupeRoot: string, fetchTags: () => Promise<string[]> = fetchReleaseTags): Promise<UpdateStatus> {
  const current = currentVersion(loupeRoot);
  const now = Date.now();
  if (cache && now - cache.at < CACHE_MS && cache.status.current === current) return cache.status;
  const latest = latestVersion(current, await fetchTags());
  const status: UpdateStatus = { behind: latest !== current, current, latest };
  cache = { at: now, status };
  return status;
}

export function resetUpdateCache(): void {
  cache = null;
}
