// argument checks for `lsp set <lang> <command>` and `lsp unset <lang>`; pure, no io.

import { expectLanguage, validateOverrideCommand } from "../core/lsp/overrides";
import type { LspLanguage } from "../core/lsp/registry";
import type { LspAction } from "./cliVocabulary";

export interface LspTarget { language: LspLanguage; command: string }

// positionals after the subcommand. set takes a language and one command string (quote it
// when it has arguments); an empty string disables the language. bare `lsp` takes none.
export function parseLspTarget(action: LspAction | undefined, positionals: readonly string[]): LspTarget | undefined {
  if (action === undefined) {
    if (positionals.length) throw new Error(`unexpected argument: ${positionals[0]} (lsp takes set or unset)`);
    return undefined;
  }
  const [language, command, ...extra] = positionals;
  if (action === "unset") {
    if (command !== undefined) throw new Error(`unexpected argument: ${command} (lsp unset takes only a language)`);
    return { language: expectLanguage(language), command: "" };
  }
  if (command === undefined) throw new Error('lsp set needs a language and a command, e.g. lsp set python "pyrefly lsp" ("" disables it)');
  if (extra.length) throw new Error(`unexpected argument: ${extra[0]} (quote a command that has arguments)`);
  return { language: expectLanguage(language), command: validateOverrideCommand(command) };
}
