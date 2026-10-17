// keeps nittle's own .review out of the file list it renders. git's exclude rules already hide
// an untracked one, but a .review committed before nittle ever ran still shows up in branch,
// range, staged and browse listings — this is the one place that decides, for every mode.

import { REVIEW_FILE, type DiffResult } from "../types";

export function excludeReviewFile(diff: DiffResult, show: boolean): DiffResult {
  if (show) return diff;
  const files = diff.files.filter((f) => f.path !== REVIEW_FILE && f.oldPath !== REVIEW_FILE);
  return files.length === diff.files.length ? diff : { ...diff, files };
}
