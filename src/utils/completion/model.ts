// the completion model: commands, subcommands, flags and flag values, read from the flag table the
// parser enforces and --help renders (cliFlags.ts). every shell renderer reads this and nothing else.

import { COMMAND_HELP, type HelpTopic } from "../usage/commandHelp";
import { FLAG_SPECS, flagAccepted, type FlagSpec } from "../cliFlags";
import { COMMANDS, HOOK_SUBCOMMANDS, MCP_ACTIONS } from "../cliVocabulary";

export interface CompletionFlag {
  names: string[]; // e.g. ["-p", "--port"]
  description: string;
  takesValue: boolean;
  values: readonly string[]; // enumerable values; empty = free text
}

// the flags valid at one point: a command, or a command plus its subcommand ("mcp serve").
export interface CompletionScope {
  key: string;
  flags: CompletionFlag[];
}

export interface CompletionCommand {
  name: HelpTopic;
  summary: string;
  subcommands: readonly string[];
  scopes: CompletionScope[];
  completesRefs: boolean; // the first positional is a ref
  words: readonly string[]; // fixed words offered beside refs
}

// the refs a tab press lists. renderers run this at completion time, never at generation.
export const REF_LIST_ARGS = ["for-each-ref", "--format=%(refname:short)", "refs/heads", "refs/remotes", "refs/tags"] as const;

const REF_WORDS: Partial<Record<HelpTopic, readonly string[]>> = { review: ["staged", "browse"] };
const SUBCOMMANDS: Partial<Record<HelpTopic, readonly string[]>> = { mcp: MCP_ACTIONS, hook: HOOK_SUBCOMMANDS };
const REF_COMMANDS: readonly HelpTopic[] = ["review", "show"];

const toFlag = (spec: FlagSpec): CompletionFlag => ({
  names: [...spec.names], description: spec.description, takesValue: spec.valueName !== undefined, values: spec.values ?? [],
});

function scopeFlags(command: HelpTopic, hasSubcommands: boolean, subcommand?: string): CompletionFlag[] {
  return FLAG_SPECS.filter((spec) => flagAccepted(spec, command, hasSubcommands, subcommand)).map(toFlag);
}

export function completionModel(): CompletionCommand[] {
  return COMMANDS.map((name) => {
    const subcommands = SUBCOMMANDS[name] ?? [];
    const hasSubcommands = subcommands.length > 0;
    const scopes: CompletionScope[] = [{ key: name, flags: scopeFlags(name, hasSubcommands) }];
    for (const sub of subcommands) scopes.push({ key: `${name} ${sub}`, flags: scopeFlags(name, true, sub) });
    return { name, summary: COMMAND_HELP[name].summary, subcommands, scopes, completesRefs: REF_COMMANDS.includes(name), words: REF_WORDS[name] ?? [] };
  });
}

// commands typed as the first word; review is the default and has no word of its own.
export const namedCommands = (model: CompletionCommand[]) => model.filter((command) => command.name !== "review");
