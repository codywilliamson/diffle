// maps c# files to their owning .csproj and reads project references between them.

import { readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import type { SnapshotReader } from "../snapshotReader";
import type { ReviewGroupKey } from "./adapter";
import { isInside, stemOf, topLevelGroup } from "./flagHelpers";

const PROJECT_REFERENCE = /<ProjectReference\s[^>]*?Include="([^"]+)"/g;

// cwd -> directory -> owning project (null = none), so walking up is paid once per folder
const projectCache = new Map<string, Map<string, ReviewGroupKey | null>>();

export const resetCsharpProjectCache = (): void => projectCache.clear();

const toPosix = (p: string): string => p.replace(/\\/g, "/");

function projectIn(dir: string, root: string): ReviewGroupKey | null {
  let names: string[];
  try {
    names = readdirSync(dir).filter((n) => n.toLowerCase().endsWith(".csproj")).sort();
  } catch {
    return null; // folder is gone (deleted file) — keep walking up
  }
  const name = names[0];
  return name ? { id: toPosix(relative(root, join(dir, name))), label: stemOf(name) } : null;
}

function findProject(dir: string, root: string, cache: Map<string, ReviewGroupKey | null>): ReviewGroupKey | null {
  if (cache.has(dir)) return cache.get(dir) ?? null;
  let found = projectIn(dir, root);
  if (!found && dir !== root && isInside(root, dirname(dir))) found = findProject(dirname(dir), root, cache);
  cache.set(dir, found);
  return found;
}

export function csharpGroupOf(path: string, cwd: string): ReviewGroupKey {
  const root = resolve(cwd);
  let cache = projectCache.get(root);
  if (!cache) projectCache.set(root, (cache = new Map()));
  const dir = dirname(resolve(root, path));
  return (isInside(root, dir) ? findProject(dir, root, cache) : null) ?? topLevelGroup(path);
}

function referencedProjects(projectId: string, root: string, read: SnapshotReader): string[] {
  const abs = resolve(root, projectId);
  const xml = read(projectId);
  if (xml === null) return [];
  return [...xml.matchAll(PROJECT_REFERENCE)].map((m) => toPosix(relative(root, resolve(dirname(abs), toPosix(m[1]!)))));
}

export function csharpGroupDependencies(groupIds: string[], cwd: string, read: SnapshotReader): Record<string, string[]> {
  const root = resolve(cwd);
  const known = new Set(groupIds);
  const out: Record<string, string[]> = {};
  for (const id of groupIds) {
    const isProject = id.toLowerCase().endsWith(".csproj");
    out[id] = isProject ? referencedProjects(id, root, read).filter((ref) => known.has(ref) && ref !== id) : [];
  }
  return out;
}
