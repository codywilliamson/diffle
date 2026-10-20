// user-chosen server commands: `--lsp <lang>=<command>` for one run, `lsp set` for good.
// the command line is split into argv here and run directly, never through a shell.

import { LSP_LANGUAGES, type LspLanguage } from "./registry";

export type LspOverrides = Partial<Record<LspLanguage, string>>; // "" disables the language

export const isLspLanguage = (value: string): value is LspLanguage => (LSP_LANGUAGES as readonly string[]).includes(value);

export function expectLanguage(value: string | undefined): LspLanguage {
  if (value !== undefined && isLspLanguage(value)) return value;
  throw new Error(`unknown language "${value ?? ""}" (one of: ${LSP_LANGUAGES.join(", ")})`);
}

// splits on whitespace; single or double quotes group. backslashes stay literal (windows paths).
export function splitCommandLine(line: string): string[] {
  const words: string[] = [];
  let current = "";
  let inWord = false;
  let quote: string | undefined;
  for (const char of line) {
    if (quote) { if (char === quote) quote = undefined; else current += char; continue; }
    if (char === '"' || char === "'") { quote = char; inWord = true; continue; }
    if (/\s/.test(char)) { if (inWord) words.push(current); current = ""; inWord = false; continue; }
    current += char;
    inWord = true;
  }
  if (quote) throw new Error(`unterminated ${quote} in command: ${line}`);
  if (inWord) words.push(current);
  return words;
}

// checks a command is well formed; returns it trimmed.
export function validateOverrideCommand(command: string): string {
  splitCommandLine(command);
  return command.trim();
}

// "rust=rust-analyzer" -> [rust, "rust-analyzer"]; "rust=" disables rust.
export function parseOverrideFlag(raw: string | undefined): [LspLanguage, string] {
  const eq = (raw ?? "").indexOf("=");
  if (!raw || eq < 0) throw new Error("--lsp needs <lang>=<command> (an empty command disables the language)");
  return [expectLanguage(raw.slice(0, eq)), validateOverrideCommand(raw.slice(eq + 1))];
}

// stored overrides, minus anything the registry no longer knows; run overrides win.
export function mergeOverrides(stored: Record<string, string> | undefined, run: LspOverrides | undefined): LspOverrides {
  const merged: LspOverrides = {};
  for (const [language, command] of Object.entries(stored ?? {})) {
    if (isLspLanguage(language) && typeof command === "string") merged[language] = command;
  }
  return { ...merged, ...run };
}
