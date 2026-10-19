// maps a server search hit onto the cursor's diff: which file it belongs to and which stop to
// land on. the server searches whole files, so a hit can sit outside every hunk; it lands on
// the nearest line that is in the diff.

import type { DiffFile, SearchHit } from "$types";
import type { Side } from "$lib/diff/threads";
import type { Stop, StopIndex } from "./cursorSteps";

// old-side hits carry the file's old path (renames); new-side hits carry its current path.
export function resolveHitFile(files: DiffFile[], hit: Pick<SearchHit, "path" | "side">): DiffFile | undefined {
  return hit.side === "old" ? files.find((f) => (f.oldPath ?? f.path) === hit.path) : files.find((f) => f.path === hit.path);
}

// the number a stop has on `side`; in a split file a stop only exists on the pane it belongs to.
function numberOn(stop: Stop, side: Side, split: boolean): number | null {
  if (split) return stop.side === side ? stop.line : null;
  return side === "new" ? stop.newLine : stop.oldLine;
}

export function findHitStop(index: StopIndex, path: string, side: Side, line: number, split: boolean): Stop | null {
  const fi = index.fileOf.get(path);
  if (fi === undefined) return null;
  let best: Stop | null = null;
  let bestGap = Infinity;
  for (const stop of index.stops.slice(index.fileStart[fi], index.fileStart[fi + 1])) {
    const n = numberOn(stop, side, split);
    if (n == null) continue;
    const gap = Math.abs(n - line);
    if (gap < bestGap) {
      best = stop;
      bestGap = gap;
    }
  }
  return best;
}
