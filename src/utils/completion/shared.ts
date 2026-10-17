// small helpers every shell renderer uses: quoting and flag lookups over the model.

import { PRODUCT } from "../../core/product";
import { REF_LIST_ARGS, type CompletionCommand, type CompletionFlag, type CompletionScope } from "./model";

export const PROGRAM = PRODUCT.name;

export const shSingleQuote = (text: string) => `'${text.split("'").join("'\\''")}'`;
export const fishSingleQuote = (text: string) => `'${text.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
export const psSingleQuote = (text: string) => `'${text.split("'").join("''")}'`;

// the ref listing as one command line, per quoting style (bash, zsh and fish share the posix form).
export const posixRefCommand = () => `command git ${REF_LIST_ARGS.map((arg) => (arg.includes("%") ? shSingleQuote(arg) : arg)).join(" ")} 2>/dev/null`;
export const powershellRefCommand = () => `& git ${REF_LIST_ARGS.map((arg) => (arg.includes("%") ? psSingleQuote(arg) : arg)).join(" ")} 2>$null`;

export const scopeFlagNames = (scope: CompletionScope) => scope.flags.flatMap((flag) => flag.names);
export const allScopes = (model: CompletionCommand[]) => model.flatMap((command) => command.scopes);

// each distinct flag name once, with the flag it belongs to (a flag can repeat across scopes).
export function uniqueFlagNames(model: CompletionCommand[]): Map<string, CompletionFlag> {
  const seen = new Map<string, CompletionFlag>();
  for (const scope of allScopes(model)) for (const flag of scope.flags) for (const name of flag.names) if (!seen.has(name)) seen.set(name, flag);
  return seen;
}

// every flag spelling that is followed by a value, across all commands.
export const valueFlagNames = (model: CompletionCommand[]) => [...uniqueFlagNames(model)].filter(([, flag]) => flag.takesValue).map(([name]) => name);

// how many words the command itself uses (review = 0, show = 1, mcp serve = 2): positionals start after them.
export const commandWordCount = (scopeKey: string) => (scopeKey === "review" ? 0 : scopeKey.split(" ").length);
