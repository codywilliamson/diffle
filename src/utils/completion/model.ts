// the completion model: commands, subcommands, flags and flag values, derived from the same
// tables the parser and --help use. every shell renderer reads this and nothing else.

import { agentTargets } from "../../core/agentTargets";
import { COMMAND_HELP, type HelpTopic } from "../usage/commandHelp";
import { COMPLETION_SHELLS, HOOK_AGENTS, HOOK_SUBCOMMANDS, MCP_ACTIONS } from "../cliVocabulary";

export interface CompletionFlag {
  names: string[]; // e.g. ["-p", "--port"]
  description: string;
  takesValue: boolean;
  values: readonly string[]; // enumerable values; empty = free text
}

export interface CompletionCommand {
  name: HelpTopic;
  summary: string;
  subcommands: readonly string[];
  flags: CompletionFlag[];
  completesRefs: boolean; // first positional is a ref
  words: readonly string[]; // fixed words offered beside refs
}

// the refs a tab press lists. renderers run this at completion time, never at generation.
export const REF_LIST_ARGS = ["for-each-ref", "--format=%(refname:short)", "refs/heads", "refs/remotes", "refs/tags"] as const;

const HELP_FLAG: [string, string] = ["-h, --help", "show help"];
const REF_WORDS: Partial<Record<HelpTopic, readonly string[]>> = { review: ["staged", "browse"] };
const SUBCOMMANDS: Partial<Record<HelpTopic, readonly string[]>> = { mcp: MCP_ACTIONS, hook: HOOK_SUBCOMMANDS };
const REF_COMMANDS: readonly HelpTopic[] = ["review", "show"];

const flagValues = (): Record<string, readonly string[]> => ({
  "--agent": HOOK_AGENTS,
  "--agents": agentTargets().map((target) => target.id),
  "--shell": COMPLETION_SHELLS,
});

// "-p, --port <n>" -> names + whether a value follows
function parseFlag([label, description]: [string, string], values: Record<string, readonly string[]>): CompletionFlag {
  const names = label.split(",").map((part) => part.trim().split(/\s+/)[0] as string);
  const long = names.find((name) => name.startsWith("--")) ?? names[0]!;
  return { names, description, takesValue: label.includes("<"), values: values[long] ?? [] };
}

export function completionModel(): CompletionCommand[] {
  const values = flagValues();
  return (Object.keys(COMMAND_HELP) as HelpTopic[]).map((name) => {
    const help = COMMAND_HELP[name];
    const options = [...(help.options ?? [])];
    if (!options.some(([label]) => label.includes("--help"))) options.push(HELP_FLAG);
    return {
      name,
      summary: help.summary,
      subcommands: SUBCOMMANDS[name] ?? [],
      flags: options.map((option) => parseFlag(option, values)),
      completesRefs: REF_COMMANDS.includes(name),
      words: REF_WORDS[name] ?? [],
    };
  });
}

// commands typed as the first word; review is the default and has no word of its own.
export const namedCommands = (model: CompletionCommand[]) => model.filter((command) => command.name !== "review");
