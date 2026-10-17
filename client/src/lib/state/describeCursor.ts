import { FILE_LEVEL, type CursorPos } from "./cursorSteps";
import type { VisualRange } from "./cursorVisual";

// what a screen reader hears for the cursor's position.
export function describeCursor(pos: CursorPos): string {
  if (pos.line === FILE_LEVEL) return `${pos.path}, file header`;
  return `${pos.path} line ${pos.line}, ${pos.side} side`;
}

export function describeVisual(range: VisualRange): string {
  return `visual range, ${range.path} ${range.side} lines ${Math.min(range.from, range.to)} to ${Math.max(range.from, range.to)}`;
}

export const VISUAL_CANCELLED = "visual cancelled";
