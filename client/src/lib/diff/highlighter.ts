// shiki core on the oniguruma engine (~6x faster than the js regex engine on real code). the wasm
// ships inlined in a lazy chunk, so static serving needs no .wasm type; grammars load one chunk
// per language.
import { createHighlighterCore, type GrammarState, type HighlighterCore, type ThemedToken } from "shiki/core";
import { createOnigurumaEngine } from "shiki/engine/oniguruma";
import { bundledLanguages } from "shiki/langs";
import { INHERIT, SYNTAX_THEME } from "./syntaxTheme";
import { escapeHtml } from "./html";

export type { GrammarState };

const THEME = SYNTAX_THEME.name as string;
// minified or generated lines are left plain rather than stalling the tokenizer.
const MAX_LINE_LENGTH = 2000;
const ITALIC = 1;
const BOLD = 2;

let core: Promise<HighlighterCore> | null = null;

function highlighter(): Promise<HighlighterCore> {
  core ??= createHighlighterCore({ themes: [SYNTAX_THEME], langs: [], engine: createOnigurumaEngine(import("shiki/wasm")) });
  return core;
}

// the highlighter with `lang` loaded, or null when the grammar is unknown or fails to load.
export async function highlighterFor(lang: string): Promise<HighlighterCore | null> {
  const hl = await highlighter();
  if (hl.getLoadedLanguages().includes(lang)) return hl;
  const load = bundledLanguages[lang as keyof typeof bundledLanguages];
  if (!load) return null;
  try {
    await hl.loadLanguage(load);
    return hl;
  } catch {
    return null;
  }
}

function tokenHtml(token: ThemedToken): string {
  const text = escapeHtml(token.content);
  const style = [
    token.color && token.color !== INHERIT ? `color:${token.color}` : "",
    token.fontStyle && token.fontStyle & ITALIC ? "font-style:italic" : "",
    token.fontStyle && token.fontStyle & BOLD ? "font-weight:600" : "",
  ].filter(Boolean).join(";");
  return style ? `<span style="${style}">${text}</span>` : text;
}

// one html string per input line plus the state after them, continuing from `state` when given.
export function highlightLines(
  hl: HighlighterCore,
  lines: string[],
  lang: string,
  state?: GrammarState,
): { lines: string[]; state: GrammarState | undefined } {
  const result = hl.codeToTokens(lines.join("\n"), { lang, theme: THEME, grammarState: state, tokenizeMaxLineLength: MAX_LINE_LENGTH });
  return { lines: lines.map((_, i) => (result.tokens[i] ?? []).map(tokenHtml).join("")), state: result.grammarState };
}

// the grammar state after tokenizing `lines`, so a later block can resume mid-file.
export function stateAfter(hl: HighlighterCore, lines: string[], lang: string, state?: GrammarState): GrammarState {
  return hl.getLastGrammarState(lines.join("\n"), { lang, theme: THEME, grammarState: state, tokenizeMaxLineLength: MAX_LINE_LENGTH });
}
