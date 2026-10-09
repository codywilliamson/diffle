// groups files and puts them in a suggested review order: dependencies first, noise last.

import type { FileAnalysis, ReviewGroup } from "../../types";
import { adapterFor } from "./languages";
import type { LanguageAdapter } from "./languages/adapter";
import { createSnapshot, type Snapshot } from "./snapshot";

export const NOISE_GROUP: ReviewGroup = { id: "noise", label: "Generated & lockfiles", files: [] };

interface Bucket {
  id: string;
  label: string;
  adapters: Set<LanguageAdapter>;
  files: FileAnalysis[];
}

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const byLabel = (a: Bucket, b: Bucket): number => byText(a.label, b.label) || byText(a.id, b.id);

function bucketize(files: FileAnalysis[], cwd: string, snapshot: Snapshot): Bucket[] {
  const buckets = new Map<string, Bucket>();
  for (const file of files) {
    if (file.noise) continue;
    const adapter = adapterFor(file.path);
    const key = adapter.groupOf(file.path, cwd, snapshot);
    const bucket = buckets.get(key.id) ?? { id: key.id, label: key.label, adapters: new Set(), files: [] };
    bucket.adapters.add(adapter);
    bucket.files.push(file);
    buckets.set(key.id, bucket);
  }
  return [...buckets.values()];
}

// bucket id -> bucket ids it depends on, as reported by each adapter
function dependencyMap(buckets: Bucket[], cwd: string, snapshot: Snapshot): Map<string, Set<string>> {
  const deps = new Map<string, Set<string>>(buckets.map((b) => [b.id, new Set<string>()]));
  const adapters = new Set(buckets.flatMap((b) => [...b.adapters]));
  for (const adapter of adapters) {
    const ids = buckets.filter((b) => b.adapters.has(adapter)).map((b) => b.id);
    const found = adapter.groupDependencies?.(ids, cwd, snapshot) ?? {};
    for (const [from, tos] of Object.entries(found)) {
      for (const to of tos) deps.get(from)?.add(to);
    }
  }
  return deps;
}

// kahn's algorithm; ties and cycles fall back to alphabetical by label
function sortBuckets(buckets: Bucket[], deps: Map<string, Set<string>>): Bucket[] {
  const remaining = [...buckets].sort(byLabel);
  const sorted: Bucket[] = [];
  while (remaining.length) {
    const left = new Set(remaining.map((b) => b.id));
    const ready = remaining.filter((b) => [...(deps.get(b.id) ?? [])].every((d) => !left.has(d) || d === b.id));
    const next = ready[0] ?? remaining[0]!;
    sorted.push(next);
    remaining.splice(remaining.indexOf(next), 1);
  }
  return sorted;
}

// non-test files by path, each followed by its paired test; unpaired tests after
function orderWithin(files: FileAnalysis[]): FileAnalysis[] {
  const sorted = [...files].sort((a, b) => byText(a.path, b.path));
  const byPath = new Map(sorted.map((f) => [f.path, f]));
  const placed = new Set<string>();
  const out: FileAnalysis[] = [];
  const place = (file: FileAnalysis | undefined): void => {
    if (file && !placed.has(file.path)) {
      placed.add(file.path);
      out.push(file);
    }
  };
  for (const file of sorted.filter((f) => !f.isTest)) {
    place(file);
    place(file.testPair ? byPath.get(file.testPair) : undefined);
  }
  sorted.filter((f) => f.isTest).forEach(place);
  return out;
}

export function orderReview(files: FileAnalysis[], cwd: string, snapshot: Snapshot = createSnapshot(cwd, null)): { groups: ReviewGroup[]; ordered: FileAnalysis[] } {
  const buckets = bucketize(files, cwd, snapshot);
  const groups: ReviewGroup[] = [];
  const ordered: FileAnalysis[] = [];
  for (const bucket of sortBuckets(buckets, dependencyMap(buckets, cwd, snapshot))) {
    const inOrder = orderWithin(bucket.files);
    groups.push({ id: bucket.id, label: bucket.label, files: inOrder.map((f) => f.path) });
    ordered.push(...inOrder);
  }
  const noise = files.filter((f) => f.noise).sort((a, b) => byText(a.path, b.path));
  if (noise.length) {
    groups.push({ ...NOISE_GROUP, files: noise.map((f) => f.path) });
    ordered.push(...noise);
  }
  return { groups, ordered };
}
