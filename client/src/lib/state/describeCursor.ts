import { FILE_LEVEL, type CursorPos } from "./cursorSteps";

// what a screen reader hears for the cursor's position.
export function describeCursor(pos: CursorPos): string {
  if (pos.line === FILE_LEVEL) return `${pos.path}, file header`;
  return `${pos.path} line ${pos.line}, ${pos.side} side`;
}
