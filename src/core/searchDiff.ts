// runs one search pattern over every text file in a diff, old side and new side, with a global result cap.

import type { DiffFile, SearchHit, SearchResponse, SearchSide } from "../types";
import { MAX_SEARCH_FILE_BYTES, MAX_SEARCH_RESULTS, searchText, type SearchPattern } from "./search";

const NUL_SNIFF_BYTES = 8_000;

// bytes of one side of one path, or null when it doesn't exist there
export type SideReader = (path: string, side: SearchSide) => Uint8Array | null;

// called after each searched side with everything found so far, so a killed worker still has partial results
export type SearchProgress = (response: SearchResponse) => void;

export interface SearchTarget {
  path: string;
  side: SearchSide;
}

// deleted files only have an old side, added only a new one; a rename reads the old path's old side
// and the new path's new side. binary files have none.
export function targetsFor(file: DiffFile): SearchTarget[] {
  if (file.binary) return [];
  const oldTarget: SearchTarget = { path: file.oldPath ?? file.path, side: "old" };
  const newTarget: SearchTarget = { path: file.path, side: "new" };
  if (file.changeType === "deleted") return [oldTarget];
  if (file.changeType === "added") return [newTarget];
  return [oldTarget, newTarget];
}

const looksBinary = (bytes: Uint8Array) => bytes.subarray(0, NUL_SNIFF_BYTES).includes(0);

export function searchDiffFiles(files: DiffFile[], read: SideReader, pattern: SearchPattern, onProgress?: SearchProgress): SearchResponse {
  const results: SearchHit[] = [];
  let truncated = false;
  for (const file of files) {
    for (const { path, side } of targetsFor(file)) {
      const bytes = read(path, side);
      if (!bytes || looksBinary(bytes)) continue;
      const oversized = bytes.length > MAX_SEARCH_FILE_BYTES;
      const text = new TextDecoder().decode(oversized ? bytes.subarray(0, MAX_SEARCH_FILE_BYTES) : bytes);
      const found = searchText(text, pattern, { path, side, limit: MAX_SEARCH_RESULTS - results.length });
      results.push(...found.hits);
      truncated ||= found.truncated || oversized;
      onProgress?.({ results, truncated });
      if (results.length >= MAX_SEARCH_RESULTS && found.truncated) return { results, truncated: true };
    }
  }
  return { results, truncated };
}
