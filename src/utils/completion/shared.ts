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

// how many positional words (flags and flag values skipped) come before a command's ref or
// subcommand slot: 0 for the default review, 1 behind a named command.
export const slotAfterPositionals = (command: CompletionCommand) => (command.name === "review" ? 0 : 1);

// every flag spelling that is followed by a value, across all commands.
export function valueFlagNames(model: CompletionCommand[]): string[] {
  return [...uniqueFlagNames(model)].filter(([, flag]) => flag.takesValue).map(([name]) => name);
}
