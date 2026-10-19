// maps pixels and dom nodes in a rendered diff row onto lsp positions. a row's code sits in a
// `.code-inner` element carrying data-lsp-side and data-lsp-line; whatever spans the highlighter,
// the word-diff marks or the search marks wrap around the text, textContent is still exactly the
// line, so a utf-16 offset into it is the lsp character. wrapping does not matter: offsets count
// characters, not visual lines.

import type { LspSide } from "$types";
import { tokenAt, type Token } from "./token";

export const LSP_ROW_SELECTOR = "[data-lsp-line]";

export interface CodeHit {
  path: string;
  side: LspSide;
  line: number; // 1-based on that side
  token: Token; // character offsets of the word, utf-16
  root: HTMLElement; // the .code-inner holding the line
}

// utf-16 offset of (node, offset) from the start of `root`'s text
export function textOffset(root: Node, node: Node, offset: number): number {
  const range = document.createRange();
  range.setStart(root, 0);
  range.setEnd(node, offset);
  return range.toString().length;
}

// a dom range covering [start, end) of `root`'s text, for measuring where a word is on screen
export function rangeFor(root: Node, start: number, end: number): Range | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  let seen = 0;
  let began = false;
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    const length = node.data.length;
    if (!began && start < seen + length) {
      range.setStart(node, start - seen);
      began = true;
    }
    if (began && end <= seen + length) {
      range.setEnd(node, end - seen);
      return range;
    }
    seen += length;
  }
  return null;
}

// the hit for a word in a row, or null when the row carries no position
export function hitInRow(root: HTMLElement, token: Token): CodeHit | null {
  const side = root.dataset.lspSide;
  const line = Number(root.dataset.lspLine);
  const path = root.closest<HTMLElement>("[data-file-path]")?.dataset.filePath;
  if ((side !== "old" && side !== "new") || !Number.isInteger(line) || !path) return null;
  return { path, side, line, token, root };
}

// the hit for a caret inside a row's code, or null when the caret is not on a word
export function hitAtCaret(root: HTMLElement, node: Node, offset: number): CodeHit | null {
  const token = tokenAt(root.textContent ?? "", textOffset(root, node, offset));
  return token ? hitInRow(root, token) : null;
}

interface CaretSource {
  caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  caretRangeFromPoint?: (x: number, y: number) => Range | null;
}

function caretFromPoint(x: number, y: number): { node: Node; offset: number } | null {
  const doc = document as unknown as CaretSource;
  const position = doc.caretPositionFromPoint?.(x, y);
  if (position) return { node: position.offsetNode, offset: position.offset };
  const range = doc.caretRangeFromPoint?.(x, y);
  return range ? { node: range.startContainer, offset: range.startOffset } : null;
}

// the word under a screen point inside a diff row, or null
export function hitAtPoint(x: number, y: number): CodeHit | null {
  const caret = caretFromPoint(x, y);
  const element = caret && (caret.node instanceof Element ? caret.node : caret.node.parentElement);
  const root = element?.closest<HTMLElement>(LSP_ROW_SELECTOR);
  if (!caret || !root) return null;
  const hit = hitAtCaret(root, caret.node, caret.offset);
  if (!hit) return null;
  // a caret snaps to the nearest character even when the pointer is far from any glyph, so the
  // pointer must really be over the word
  const box = rangeFor(root, hit.token.start, hit.token.end)?.getBoundingClientRect();
  const over = box && x >= box.left - 1 && x <= box.right + 1 && y >= box.top - 1 && y <= box.bottom + 1;
  return over ? hit : null;
}
