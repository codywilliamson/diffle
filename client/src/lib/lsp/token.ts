// finding the word a pointer or the cursor means inside one line of code. offsets are js string
// (utf-16) offsets into the line text, the same unit the lsp routes speak, so a line with emoji
// or cjk before the word still lands on it.

export interface Token {
  start: number; // inclusive
  end: number; // exclusive
  text: string;
}

const WORD = /[\p{L}_$][\p{L}\p{N}_$]*/gu;

// words that name nothing a language server can answer about; skipped when the cursor has no column
const KEYWORDS = new Set([
  "abstract", "as", "async", "await", "break", "case", "catch", "class", "const", "continue", "default", "delete",
  "do", "else", "enum", "export", "extends", "false", "finally", "for", "from", "function", "get", "if", "implements",
  "import", "in", "interface", "internal", "is", "let", "namespace", "new", "null", "of", "override", "private",
  "protected", "public", "readonly", "return", "sealed", "set", "static", "struct", "super", "switch", "this", "throw",
  "true", "try", "type", "typeof", "undefined", "using", "var", "virtual", "void", "while", "yield",
  "bool", "byte", "char", "decimal", "double", "float", "int", "long", "object", "string", "number", "boolean",
]);

function wordsIn(text: string): Token[] {
  return [...text.matchAll(WORD)].map((m) => ({ start: m.index, end: m.index + m[0].length, text: m[0] }));
}

// the word under a caret offset. a caret between two characters belongs to the word on its left
// when the right side is not part of one, so aiming at the end of `foo` in `foo(` still means foo.
export function tokenAt(text: string, offset: number): Token | null {
  const words = wordsIn(text);
  return words.find((w) => offset >= w.start && offset < w.end) ?? words.find((w) => w.end === offset) ?? null;
}

// the first word on a line that is not a keyword or a primitive type: where `gd` lands when the
// reader never pointed at anything.
export function firstSymbol(text: string): Token | null {
  return wordsIn(text).find((w) => !KEYWORDS.has(w.text)) ?? null;
}
