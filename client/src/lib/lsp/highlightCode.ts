// syntax highlighting for code that is not a diff row: fenced blocks in hover docs and the
// read-only file viewer. both use the diff's shiki theme, so the colors follow the viewer's
// light and dark tokens.

import { bundledLanguages } from "shiki/langs";
import { highlighterFor, highlightLines } from "$lib/diff/highlighter";
import { languageFor } from "$lib/diff/languages";

// the viewer highlights at most this many lines (tokenizing is ~0.1ms per line on the main thread)
export const MAX_HIGHLIGHT_LINES = 6000;

// a markdown fence label ("ts", "csharp") as a shiki language, or null
function fenceLanguage(label: string): string | null {
  return label in bundledLanguages ? label : languageFor(`x.${label}`);
}

// one html string per line, or null when there is no grammar for the path
export async function highlightText(path: string, text: string): Promise<string[] | null> {
  const lang = languageFor(path);
  const lines = text.split(/\r?\n/);
  if (!lang || lines.length > MAX_HIGHLIGHT_LINES) return null;
  const hl = await highlighterFor(lang);
  return hl ? highlightLines(hl, lines, lang).lines : null;
}

// highlight every fenced code block under `container` in place. the markdown was sanitized before
// it got here and shiki output only contains escaped text and color styles.
export async function highlightCodeBlocks(container: HTMLElement): Promise<void> {
  const blocks = [...container.querySelectorAll<HTMLElement>("pre > code[class*='language-']")];
  for (const block of blocks) {
    const label = /language-([\w+#.-]+)/.exec(block.className)?.[1];
    const lang = label ? fenceLanguage(label) : null;
    const hl = lang ? await highlighterFor(lang) : null;
    if (!lang || !hl || !block.isConnected) continue;
    block.innerHTML = highlightLines(hl, (block.textContent ?? "").replace(/\n$/, "").split("\n"), lang).lines.join("\n");
  }
}
