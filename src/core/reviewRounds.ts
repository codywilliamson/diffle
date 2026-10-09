// snapshots of the new-side content at the moment feedback is returned, so the next round can show
// only what changed since then (interdiff).

import type { DiffFile, ReviewRound } from "../types";
import { diffBlobs, refBlobs, stagedBlobs, workingTreeBlobs, type BlobMap } from "../utils/gitBlobs";
import { parseDiff } from "./diffParser";

// newRef: null = working tree, "" = staged, otherwise a committed ref
// write: store working-tree blobs in the object db (only needed when they are diffed later)
function currentBlobs(cwd: string, newRef: string | null, paths: string[], write: boolean): BlobMap {
  if (newRef === null) return workingTreeBlobs(cwd, paths, write);
  if (newRef === "") return stagedBlobs(cwd, paths);
  return refBlobs(cwd, newRef, paths);
}

export function captureRound(cwd: string, newRef: string | null, paths: string[]): ReviewRound {
  return { capturedAt: new Date().toISOString(), blobs: currentBlobs(cwd, newRef, paths, true) };
}

// paths whose content differs from the round (files the round never saw count as changed)
export function changedSinceRound(round: ReviewRound, cwd: string, newRef: string | null, paths: string[]): Set<string> {
  const now = currentBlobs(cwd, newRef, paths, false);
  return new Set(paths.filter((path) => (round.blobs[path] ?? null) !== now[path]));
}

// the diff of one file between the round's blob and its current content; null when unchanged
export function interdiffFor(round: ReviewRound, path: string, cwd: string, newRef: string | null): DiffFile | null {
  const before = round.blobs[path] ?? null;
  const after = currentBlobs(cwd, newRef, [path], true)[path] ?? null;
  if (before === after) return null;
  const file = parseDiff(diffBlobs(cwd, before, after), "interdiff").files[0];
  if (!file) return null;
  return { ...file, path, oldPath: null, changeType: before === null ? "added" : after === null ? "deleted" : "modified" };
}
