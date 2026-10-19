// the word `gd`, `gy`, `gh` and `gA` act on when the keyboard drives. the line cursor has no
// column, so the word is the one the pointer last rested on if that was on the cursor's line,
// else the first real identifier on the line.

import { firstSymbol } from "./token";
import { hitInRow, type CodeHit } from "./domPosition";

const CURSOR_CODE = "[data-cursor] [data-lsp-line]";

export function cursorHit(pointed: CodeHit | null): CodeHit | null {
  const root = document.querySelector<HTMLElement>(CURSOR_CODE);
  if (!root) return null;
  if (pointed && pointed.root === root && root.isConnected) return pointed;
  const token = firstSymbol(root.textContent ?? "");
  return token ? hitInRow(root, token) : null;
}
