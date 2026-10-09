import type { DiffFile, ReviewScorecard } from "$types";
import { treeOrder } from "./tree";

// files in the scorecard's suggested review order; files it doesn't know about follow in tree order.
export function reviewOrder(files: DiffFile[], scorecard: ReviewScorecard | null): DiffFile[] {
  if (!scorecard) return treeOrder(files);
  const byPath = new Map(files.map((file) => [file.path, file]));
  const seen = new Set<string>();
  const ordered: DiffFile[] = [];
  for (const { path } of scorecard.files) {
    const file = byPath.get(path);
    if (!file || seen.has(path)) continue;
    seen.add(path);
    ordered.push(file);
  }
  return [...ordered, ...treeOrder(files.filter((file) => !seen.has(file.path)))];
}
