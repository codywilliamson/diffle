// every flag the cli accepts and where. the parser enforces this table, --help renders it, and the
// shell completions read it, so the three cannot disagree about which flag belongs to which command.

import { PRODUCT } from "../core/product";
import { AGENT_IDS, COMPLETION_SHELLS, HOOK_AGENTS, type CliCommand } from "./cliVocabulary";

export interface FlagSpec {
  names: readonly string[]; // e.g. ["-p", "--port"]
  valueName?: string; // present = the flag takes a value, shown as <valueName> in help
  values?: readonly string[]; // enumerable values
  list?: boolean; // the value is a comma-separated list of those values
  description: string;
  commands: readonly CliCommand[]; // commands that accept it
  subcommands?: readonly string[]; // for commands with subcommands: only these accept it
  beforeSubcommand?: boolean; // also valid right after the command, before any subcommand (`mcp --help`)
}

const REVIEW_AND_SHOW: readonly CliCommand[] = ["review", "show"];
const EVERY_COMMAND: readonly CliCommand[] = ["review", "show", "mcp", "hook", "sessions", "cleanup", "update", "doctor", "setup", "lsp", "completion"];

export const FLAG_SPECS: readonly FlagSpec[] = [
  { names: ["-p", "--port"], valueName: "n", description: "serve on a fixed port (default: any free port)", commands: REVIEW_AND_SHOW },
  { names: ["--no-open"], description: "don't open the browser automatically", commands: REVIEW_AND_SHOW },
  { names: ["--wait"], description: "block until feedback is returned, then print the prompt on stdout", commands: ["review"] },
  { names: ["--json"], description: "with --wait, print the review record as JSON instead of the prompt", commands: ["review"] },
  { names: ["--no-lsp"], description: "start no language servers", commands: REVIEW_AND_SHOW },
  { names: ["--lsp"], valueName: "lang=command", description: "use this server for one language this run; an empty command disables it (e.g. rust=rust-analyzer)", commands: REVIEW_AND_SHOW },
  { names: ["--review-id"], valueName: "id", description: "open an existing durable Review Record", commands: ["review"] },
  { names: ["-v", "--version"], description: "print the installed version", commands: EVERY_COMMAND },
  { names: ["--license"], description: "print the bundled MIT license notice", commands: EVERY_COMMAND },
  { names: ["--agent"], valueName: "id", values: HOOK_AGENTS, description: "the agent calling the hook: codex or claude-code", commands: ["hook"] },
  { names: ["--agents"], valueName: "ids", values: AGENT_IDS, list: true, description: "comma-separated agent ids, skips the prompt (e.g. claude,cursor)", commands: ["setup"] },
  { names: ["--remove"], description: `unwire ${PRODUCT.name} instead`, commands: ["setup"] },
  { names: ["--shell"], valueName: "shell", values: COMPLETION_SHELLS, description: `shell to generate for: ${COMPLETION_SHELLS.join(", ")}`, commands: ["completion"] },
  { names: ["--yes"], description: "skip the confirmation prompt", commands: ["cleanup", "doctor", "setup", "mcp"], subcommands: ["restart"] },
  { names: ["--all"], description: "also stop active (not just finished/stale) sessions", commands: ["cleanup"] },
  { names: ["--fix"], description: "run the repair commands through the `claude` cli", commands: ["doctor"] },
  { names: ["--check"], description: "only report whether a newer release exists", commands: ["update"] },
  { names: ["-h", "--help"], description: "show help", commands: EVERY_COMMAND, beforeSubcommand: true },
];

export const findFlag = (name: string): FlagSpec | undefined => FLAG_SPECS.find((spec) => spec.names.includes(name));

// does `command` (with `subcommand` for mcp/hook, undefined while none is chosen) accept the flag?
export function flagAccepted(spec: FlagSpec, command: CliCommand, hasSubcommands: boolean, subcommand: string | undefined): boolean {
  if (!spec.commands.includes(command)) return false;
  if (!hasSubcommands) return true;
  if (subcommand === undefined) return spec.beforeSubcommand === true;
  return spec.subcommands === undefined || spec.subcommands.includes(subcommand);
}

export const flagLabel = (spec: FlagSpec) => `${spec.names.join(", ")}${spec.valueName ? ` <${spec.valueName}>` : ""}`;

// the help options for one command, in table order.
export const optionsFor = (command: CliCommand): [string, string][] =>
  FLAG_SPECS.filter((spec) => spec.commands.includes(command)).map((spec) => [flagLabel(spec), spec.description]);
