// pairs each source file with its test (and back) when both are in the diff.

import type { DiffFile } from "../../types";
import { adapterFor } from "./languages";

const subjectKey = (path: string): string => {
  const adapter = adapterFor(path);
  return `${adapter.id}:${adapter.subjectName(path)}`;
};

function sharedDirDepth(a: string, b: string): number {
  const x = a.split("/").slice(0, -1);
  const y = b.split("/").slice(0, -1);
  let depth = 0;
  while (depth < x.length && depth < y.length && x[depth] === y[depth]) depth++;
  return depth;
}

// longest shared directory prefix wins; candidates arrive sorted, so ties go to the alphabetically first
function closest(path: string, candidates: string[]): string {
  let best = candidates[0]!;
  for (const c of candidates) if (sharedDirDepth(path, c) > sharedDirDepth(path, best)) best = c;
  return best;
}

// path -> paired path, in both directions. each test picks its closest same-named source and each source
// keeps the closest test that picked it, so same-named files elsewhere stay unpaired.
export function pairTests(files: DiffFile[]): Map<string, string> {
  const paths = files.map((f) => f.path).sort();
  const sources = new Map<string, string[]>();
  for (const path of paths) {
    if (adapterFor(path).isTest(path)) continue;
    const key = subjectKey(path);
    sources.set(key, [...(sources.get(key) ?? []), path]);
  }
  const choosers = new Map<string, string[]>();
  for (const path of paths) {
    if (!adapterFor(path).isTest(path)) continue;
    const matches = sources.get(subjectKey(path));
    if (!matches?.length) continue;
    const source = closest(path, matches);
    choosers.set(source, [...(choosers.get(source) ?? []), path]);
  }
  const pairs = new Map<string, string>();
  for (const [source, tests] of choosers) {
    const test = closest(source, tests);
    pairs.set(test, source);
    pairs.set(source, test);
  }
  return pairs;
}
