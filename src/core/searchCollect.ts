// gathers the bytes to search before any of them is searched, bounding memory and time up front.

import type { SearchSide } from "../types";
import { MAX_SEARCH_FILE_BYTES } from "./search";
import { targetsFor, type SearchFileRef } from "./searchDiff";

export const MAX_SEARCH_TOTAL_BYTES = 16_000_000;

export const contentKey = (side: SearchSide, path: string) => `${side}:${path}`;

// size is checked first, so an oversized file is never read; null = missing on that side
export interface SideSource {
  size(path: string, side: SearchSide): number | null;
  read(path: string, side: SearchSide): Uint8Array | null;
}

export interface CollectedSides {
  contents: Record<string, ArrayBuffer>; // own copies, so they can be transferred to a worker
  truncated: boolean; // something was skipped for size, the aggregate cap, or the deadline
}

export function collectSides(files: SearchFileRef[], source: SideSource, deadline: number): CollectedSides {
  const contents: Record<string, ArrayBuffer> = {};
  let total = 0;
  let truncated = false;
  for (const file of files) {
    for (const { path, side } of targetsFor(file)) {
      if (performance.now() > deadline) return { contents, truncated: true };
      const size = source.size(path, side);
      if (size === null) continue;
      if (size > MAX_SEARCH_FILE_BYTES) {
        truncated = true;
        continue;
      }
      if (total + size > MAX_SEARCH_TOTAL_BYTES) return { contents, truncated: true };
      const bytes = source.read(path, side);
      if (!bytes) continue;
      total += bytes.length;
      contents[contentKey(side, path)] = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    }
  }
  return { contents, truncated };
}

export function readerFor(contents: Record<string, ArrayBuffer>) {
  return (path: string, side: SearchSide): Uint8Array | null => {
    const buffer = contents[contentKey(side, path)];
    return buffer ? new Uint8Array(buffer) : null;
  };
}
