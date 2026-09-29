// per-command help: the single source for both `<command> --help` and the overview.

import { PRODUCT } from "../../core/product";
import { UPDATE_CHECK_OPT_OUT } from "../../core/updateNotice";
import type { CliOptions } from "../cli";

export type HelpTopic = CliOptions["command"];

export interface CommandHelp {
  summary: string;
  usage: string[];
  details?: string[];
  options?: [flag: string, description: string][];
  examples: string[];
  related: HelpTopic[];
}

const n = PRODUCT.name;
const YES: [string, string] = ["--yes", "skip the confirmation prompt"];

export const COMMAND_HELP: Record<HelpTopic, CommandHelp> = {
  review: {
    summary: "review a diff in the browser (the default command)",
    usage: [`${n} [ref] [options]`],
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
    ],
    options: [
      ["-p, --port <n>", "serve on a fixed port (default: any free port)"],
      ["--no-open", "don't open the browser automatically"],
      ["--review-id <id>", "open an existing durable Review Record"],
      ["-v, --version", "print the installed version"],
      ["--license", "print the bundled MIT license notice"],
      ["-h, --help", "show help"],
    ],
    examples: [`${n}`, `${n} staged --no-open`, `${n} main`, `${n} browse src/`],
    related: ["sessions", "cleanup"],
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
    options: [YES],
    examples: [`${n} mcp list`, `${n} mcp restart --yes`],
    related: ["update", "sessions", "setup"],
  },
  hook: {
    summary: "agent stop hook that keeps a review open until it is resolved",
    usage: [`${n} hook stop --agent <codex|claude-code>`],
    options: [["--agent <id>", "the agent calling the hook: codex or claude-code"]],
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
    options: [YES, ["--all", "also stop active (not just finished/stale) sessions"]],
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
    options: [["--check", "only report whether a newer release exists"]],
    examples: [`${n} update`, `${n} update --check`],
    related: ["mcp", "doctor"],
  },
  doctor: {
    summary: `check the Claude Code plugin install for stale ${PRODUCT.legacyName} leftovers`,
    usage: [`${n} doctor [--fix] [--yes]`],
    options: [["--fix", "run the repair commands through the `claude` cli"], YES],
    examples: [`${n} doctor`, `${n} doctor --fix`],
    related: ["setup"],
  },
  setup: {
    summary: `wire ${n} into your coding agents (plugin or MCP config)`,
    usage: [`${n} setup [--remove] [--agents <ids>] [--yes]`],
    options: [
      ["--agents <ids>", "comma-separated agent ids, skips the prompt (e.g. claude,cursor)"],
      ["--remove", `unwire ${n} instead`],
      YES,
    ],
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
