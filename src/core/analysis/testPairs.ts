// pairs each source file with its test (and back) when both are in the diff.

import type { DiffFile } from "../../types";
import { adapterFor } from "./languages";

const subjectKey = (path: string): string => {
  const adapter = adapterFor(path);
  return `${adapter.id}:${adapter.subjectName(path)}`;
};

// path -> paired path, in both directions. a test shared by several sources pairs with the first by path.
export function pairTests(files: DiffFile[]): Map<string, string> {
  const paths = files.map((f) => f.path).sort();
  const sources = new Map<string, string[]>();
  for (const path of paths) {
    if (adapterFor(path).isTest(path)) continue;
    const key = subjectKey(path);
    sources.set(key, [...(sources.get(key) ?? []), path]);
  }
  const pairs = new Map<string, string>();
  for (const path of paths) {
    if (!adapterFor(path).isTest(path)) continue;
    const matches = sources.get(subjectKey(path));
    if (!matches?.length) continue;
    pairs.set(path, matches[0]!);
    for (const source of matches) pairs.set(source, path);
  }
  return pairs;
}
