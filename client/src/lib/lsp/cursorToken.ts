// the word `gd`, `gy`, `gh` and `gA` act on when the keyboard drives. the line cursor has no
// column, so the word is the one the pointer last rested on if that was on the cursor's line,
// else the first real identifier on the line. inside the read-only viewer the "cursor" is its
// highlighted target line, and a word the pointer rested on anywhere in the viewer wins.

import { firstSymbol } from "./token";
import { hitInRow, type CodeHit } from "./domPosition";

const CURSOR_CODE = "[data-cursor] [data-lsp-line]";
const VIEWER_TARGET_CODE = "[data-lsp-viewer] [data-target-line] [data-lsp-line]";
const VIEWER_PANEL = "[data-lsp-viewer]";

function firstSymbolHit(root: HTMLElement): CodeHit | null {
  const token = firstSymbol(root.textContent ?? "");
  return token ? hitInRow(root, token) : null;
}

export function cursorHit(pointed: CodeHit | null): CodeHit | null {
  const root = document.querySelector<HTMLElement>(CURSOR_CODE);
  if (!root) return null;
  if (pointed && pointed.root === root && root.isConnected) return pointed;
  return firstSymbolHit(root);
}

export function viewerHit(pointed: CodeHit | null): CodeHit | null {
  if (pointed?.root.isConnected && pointed.root.closest(VIEWER_PANEL)) return pointed;
  const root = document.querySelector<HTMLElement>(VIEWER_TARGET_CODE);
  return root ? firstSymbolHit(root) : null;
}
