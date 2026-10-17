// tags of the published (not draft, not prerelease) GitHub releases, read-only. the transition-window
// count must only see releases users could actually have installed, never failed or draft ones.
// returns null when the API can't be read; the caller then errs towards publishing the diffle copies.

import { releasesApiUrl } from "../src/core/updateCheck";

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;
interface ApiRelease { tag_name?: string; draft?: boolean; prerelease?: boolean; }

export async function publishedReleaseTags(fetchImpl: Fetcher = fetch, token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN): Promise<string[] | null> {
  try {
    const res = await fetchImpl(releasesApiUrl().replace("per_page=20", "per_page=100"), {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "nittle-release", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!res.ok) return null;
    const releases = (await res.json()) as ApiRelease[];
    return releases.filter((r) => !r.draft && !r.prerelease && r.tag_name).map((r) => r.tag_name!);
  } catch {
    return null;
  }
}
