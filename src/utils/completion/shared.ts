// small helpers every shell renderer uses: quoting and flag lookups over the model.

import { PRODUCT } from "../../core/product";
import { REF_LIST_ARGS, type CompletionCommand, type CompletionFlag } from "./model";

export const PROGRAM = PRODUCT.name;

export const shSingleQuote = (text: string) => `'${text.replace(/'/g, "'\\''")}'`;
export const fishSingleQuote = (text: string) => `'${text.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
export const psSingleQuote = (text: string) => `'${text.replace(/'/g, "''")}'`;

// the ref listing as one command line, per quoting style (bash, zsh and fish share the posix form).
export const posixRefCommand = () => `command git ${REF_LIST_ARGS.map((arg) => (arg.includes("%") ? shSingleQuote(arg) : arg)).join(" ")} 2>/dev/null`;
export const powershellRefCommand = () => `& git ${REF_LIST_ARGS.map((arg) => (arg.includes("%") ? psSingleQuote(arg) : arg)).join(" ")} 2>$null`;

export const flagNames = (command: CompletionCommand) => command.flags.flatMap((flag) => flag.names);

// each distinct flag name once, with the flag it belongs to (a flag can repeat across commands).
export function uniqueFlagNames(model: CompletionCommand[]): Map<string, CompletionFlag> {
  const seen = new Map<string, CompletionFlag>();
  for (const command of model) for (const flag of command.flags) for (const name of flag.names) if (!seen.has(name)) seen.set(name, flag);
  return seen;
}

// 0-based word index (program = 0) where a command's first positional sits: refs and subcommands live there.
export const firstPositionalIndex = (command: CompletionCommand) => (command.name === "review" ? 1 : 2);
