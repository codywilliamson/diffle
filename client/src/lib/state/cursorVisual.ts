// the visual range: an anchor and the cursor, resolved to the (file, side, from, to) the mouse
// would have selected. the range stays on the anchor's side and inside the anchor's file, so a
// head that wandered onto the other side (unified) or into another file is clamped back in.

import type { Side } from "$lib/diff/threads";
import { FILE_LEVEL, ownStops, positionOf, type CursorPos, type StopIndex } from "./cursorSteps";

export interface VisualRange {
  path: string;
  side: Side;
  from: number; // the anchor line
  to: number; // the head line, may be above `from`
}

export function resolveVisual(index: StopIndex, anchor: CursorPos, head: CursorPos | null): VisualRange | null {
  if (anchor.line === FILE_LEVEL) return null;
  const fileIndex = index.fileOf.get(anchor.path);
  if (fileIndex === undefined) return null;
  const own = ownStops(index, anchor.path);
  const mine = own.filter((s) => s.side === anchor.side);
  if (mine.length === 0) return null;
  const range = (to: number): VisualRange => ({ path: anchor.path, side: anchor.side, from: anchor.line, to });
  if (!head || (head.path === anchor.path && head.line === FILE_LEVEL)) return range(anchor.line);
  if (head.path === anchor.path && head.side === anchor.side) return range(head.line);

  // another file, or the other side of this one: clamp to the nearest anchor-side stop
  const headFile = index.fileOf.get(head.path);
  if (headFile === undefined) return range(anchor.line);
  const down = headFile > fileIndex || (headFile === fileIndex && positionOf(index, head) > positionOf(index, anchor));
  if (headFile !== fileIndex) return range((down ? mine[mine.length - 1]! : mine[0]!).line);
  const headAt = positionOf(index, head) - index.fileStart[fileIndex]!;
  const near = down
    ? own.filter((s, i) => s.side === anchor.side && i <= headAt).pop()
    : own.find((s, i) => s.side === anchor.side && i >= headAt);
  return range((near ?? mine[0]!).line);
}
