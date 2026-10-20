// per-command help: the single source for both `<command> --help` and the overview.

import { PRODUCT } from "../../core/product";
import { UPDATE_CHECK_OPT_OUT } from "../../core/updateNotice";
import { WAIT_EXIT_HELP } from "../../core/waitExit";
import type { CliOptions } from "../cli";
import { COMPLETION_SHELLS } from "../cliVocabulary";
import { optionsFor } from "../cliFlags";

export type HelpTopic = CliOptions["command"];

export interface CommandHelp {
  summary: string;
  usage: string[];
  details?: string[];
  options?: [flag: string, description: string][]; // derived from the flag table in cliFlags.ts
  examples: string[];
  related: HelpTopic[];
}

const n = PRODUCT.name;

export const COMMAND_HELP: Record<HelpTopic, CommandHelp> = {
  review: {
    summary: "review a diff in the browser (the default command)",
    usage: [`${n} [ref] [options]`, `${n} --wait [ref] [--json]`],
    details: [
      "Refs:",
      "  (none)            working tree vs HEAD, untracked files included",
      "  staged            staged changes only",
      "  <branch>          current branch vs <branch> (pr-style three-dot)",
      "  <ref1>..<ref2>    commit range",
      "  browse [path]     review the whole codebase (optionally scoped to a path)",
      "",
      `Comments are saved to durable Review Records under ~/${PRODUCT.dataDir}/reviews and`,
      "compile into a structured review prompt from the UI.",
      "",
      "--wait is for agents without MCP: it opens the review and blocks until the reviewer",
      "sends feedback, approves or cancels, then prints the compiled prompt on stdout.",
      "Status lines go to stderr. --json prints the get_review structure instead.",
      "",
      ...WAIT_EXIT_HELP,
    ],
    options: optionsFor("review"),
    examples: [`${n}`, `${n} staged --no-open`, `${n} main`, `${n} browse src/`, `${n} --wait > feedback.md`],
    related: ["sessions", "cleanup"],
  },
  show: {
    summary: "review one commit against its first parent",
    usage: [`${n} show [rev] [options]`],
    details: [
      "Shows the commit's message, author and hash above the files. The same diff as",
      `\`${n} <rev>^!\`. With no rev it reviews HEAD. A root commit is compared with`,
      "the empty tree and a merge commit with its first parent.",
      "",
      "The review is pinned to the full commit hash, so reopening it later shows the",
      "same diff even after HEAD moves, as long as the commit still exists in the repo",
      "(a rebase plus gc removes it).",
    ],
    options: optionsFor("show"),
    examples: [`${n} show`, `${n} show HEAD~2`, `${n} show a1b2c3d --no-open`],
    related: ["review"],
  },
  mcp: {
    summary: "run or manage the local MCP server agents talk to",
    usage: [`${n} mcp serve`, `${n} mcp list`, `${n} mcp restart [--yes]`],
    details: [
      "  serve     run the local stdio MCP server (agents launch this)",
      "  list      list running MCP servers",
      "  restart   stop running MCP servers so agents relaunch them on reconnect",
      "",
      "Agents don't respawn a stopped server by themselves: after a restart,",
      "reconnect in Claude Code with /mcp, or start a new session. restart refuses",
      "while a review session is live.",
    ],
    options: optionsFor("mcp"),
    examples: [`${n} mcp list`, `${n} mcp restart --yes`],
    related: ["update", "sessions", "setup"],
  },
  hook: {
    summary: "agent stop hook that keeps a review open until it is resolved",
    usage: [`${n} hook stop --agent <codex|claude-code>`],
    options: optionsFor("hook"),
    examples: [`${n} hook stop --agent claude-code`],
    related: ["setup"],
  },
  sessions: {
    summary: "list running review sessions (host, port, age, live/stale)",
    usage: [`${n} sessions`],
    examples: [`${n} sessions`],
    related: ["cleanup"],
  },
  cleanup: {
    summary: "stop stale sessions and finished reviews",
    usage: [`${n} cleanup [--yes] [--all]`],
    options: optionsFor("cleanup"),
    examples: [`${n} cleanup`, `${n} cleanup --all --yes`],
    related: ["sessions", "mcp"],
  },
  update: {
    summary: "download and install the latest release",
    usage: [`${n} update [--check]`],
    details: [
      "Verifies the download's SHA-256, swaps the binary, then stops idle MCP servers",
      "so agents relaunch them on the new version. It ends with the next steps that",
      `apply to you. A new release is announced at launch; set ${PRODUCT.envPrefix}${UPDATE_CHECK_OPT_OUT}=1 to silence it.`,
    ],
    options: optionsFor("update"),
    examples: [`${n} update`, `${n} update --check`],
    related: ["mcp", "doctor"],
  },
  doctor: {
    summary: `check the Claude Code plugin install for stale ${PRODUCT.legacyName} leftovers`,
    usage: [`${n} doctor [--fix] [--yes]`],
    options: optionsFor("doctor"),
    examples: [`${n} doctor`, `${n} doctor --fix`],
    related: ["setup"],
  },
  lsp: {
    summary: "show which language server each language gets, and override it",
    usage: [`${n} lsp`, `${n} lsp set <lang> <command>`, `${n} lsp unset <lang>`],
    details: [
      "  (none)   one line per language: the server that will run, or what was tried and",
      "           how to install it. stored overrides are listed after the table",
      "  set      always use <command> for <lang>; quote it when it has arguments, and",
      '           use "" to disable the language',
      "  unset    drop the stored override",
      "",
      `Stored overrides live in ~/${PRODUCT.dataDir}/state.json. For one run only, pass`,
      `--lsp <lang>=<command> to \`${n}\` or \`${n} show\`. Commands are run directly, not`,
      "through a shell. An active Python virtualenv (VIRTUAL_ENV) is searched first.",
    ],
    options: optionsFor("lsp"),
    examples: [`${n} lsp`, `${n} lsp set python "basedpyright-langserver --stdio"`, `${n} lsp set rust ""`, `${n} lsp unset python`],
    related: ["review"],
  },
  completion: {
    summary: "print a tab-completion script for your shell",
    usage: [`${n} completion --shell <${COMPLETION_SHELLS.join("|")}>`],
    details: [
      "Completes commands, subcommands, flags and branch, tag and remote names. Branch",
      "names are read from git when you press tab, not when the script is generated.",
      "",
      "Install (add the line to your shell profile):",
      `  bash         eval "$(${n} completion --shell bash)"`,
      `  zsh          source <(${n} completion --shell zsh)    (after compinit)`,
      `  fish         ${n} completion --shell fish | source`,
      `  powershell   ${n} completion --shell powershell | Out-String | Invoke-Expression`,
    ],
    options: optionsFor("completion"),
    examples: [`${n} completion --shell zsh`, `${n} completion --shell powershell`],
    related: ["setup"],
  },
  setup: {
    summary: `wire ${n} into your coding agents (plugin or MCP config)`,
    usage: [`${n} setup [--remove] [--agents <ids>] [--yes]`],
    options: optionsFor("setup"),
    examples: [`${n} setup`, `${n} setup --agents claude,cursor --yes`, `${n} setup --remove`],
    related: ["doctor", "mcp"],
  },
};

const commandName = (topic: HelpTopic) => (topic === "review" ? n : `${n} ${topic}`);

export function renderCommandHelp(topic: HelpTopic): string {
  const help = COMMAND_HELP[topic];
  const blocks = [`${commandName(topic)} — ${help.summary}`, ["Usage", ...help.usage.map((line) => `  ${line}`)].join("\n")];
  if (help.details) blocks.push(help.details.join("\n"));
  if (help.options) {
    const width = Math.max(...help.options.map(([flag]) => flag.length));
    blocks.push(["Options", ...help.options.map(([flag, text]) => `  ${flag.padEnd(width)}  ${text}`)].join("\n"));
  }
  blocks.push(["Examples", ...help.examples.map((line) => `  ${line}`)].join("\n"));
  blocks.push(`See also: ${help.related.map(commandName).join(", ")}  (${n} <command> --help)`);
  return blocks.join("\n\n");
}
