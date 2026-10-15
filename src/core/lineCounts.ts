// stamps each changed file with its new-side line count, so a comment on unchanged context past the
// file's end goes stale instead of anchoring to a line that no longer exists.

import type { DiffResult } from "../types";
import { newSideLineCounts } from "../utils/gitBlobs";

export function withLineCounts(diff: DiffResult, cwd: string, newRef: string | null): DiffResult {
  const paths = diff.files.filter((f) => f.hunks.length > 0 && f.changeType !== "deleted").map((f) => f.path);
  try {
    const counts = newSideLineCounts(cwd, newRef, paths);
    return { ...diff, files: diff.files.map((f) => (counts[f.path] != null ? { ...f, lineCount: counts[f.path]! } : f)) };
  } catch {
    return diff; // without counts, context comments stay anchored while their file is present
  }
}
