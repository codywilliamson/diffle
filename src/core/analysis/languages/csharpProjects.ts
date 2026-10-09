// maps c# files to their owning .csproj and reads project references between them.

import { dirname, relative, resolve } from "node:path";
import type { Snapshot } from "../snapshot";
import type { ReviewGroupKey } from "./adapter";
import { ancestorDirs, stemOf, topLevelGroup } from "./flagHelpers";

const PROJECT_REFERENCE = /<ProjectReference\s[^>]*?Include="([^"]+)"/g;

const toPosix = (p: string): string => p.replace(/\\/g, "/");

function projectIn(dir: string, snapshot: Snapshot): ReviewGroupKey | null {
  const name = snapshot.list(dir).filter((n) => n.toLowerCase().endsWith(".csproj")).sort()[0];
  return name ? { id: dir ? `${dir}/${name}` : name, label: stemOf(name) } : null;
}

export function csharpGroupOf(path: string, _cwd: string, snapshot: Snapshot): ReviewGroupKey {
  for (const dir of ancestorDirs(path)) {
    const found = projectIn(dir, snapshot);
    if (found) return found;
  }
  return topLevelGroup(path);
}

function referencedProjects(projectId: string, root: string, snapshot: Snapshot): string[] {
  const abs = resolve(root, projectId);
  const xml = snapshot.read(projectId);
  if (xml === null) return [];
  return [...xml.matchAll(PROJECT_REFERENCE)].map((m) => toPosix(relative(root, resolve(dirname(abs), toPosix(m[1]!)))));
}

export function csharpGroupDependencies(groupIds: string[], cwd: string, snapshot: Snapshot): Record<string, string[]> {
  const root = resolve(cwd);
  const known = new Set(groupIds);
  const out: Record<string, string[]> = {};
  for (const id of groupIds) {
    const isProject = id.toLowerCase().endsWith(".csproj");
    out[id] = isProject ? referencedProjects(id, root, snapshot).filter((ref) => known.has(ref) && ref !== id) : [];
  }
  return out;
}
