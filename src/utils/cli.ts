// cli argument parsing for the diffle entry point. pure — no io, fully unit-tested.

import { PRODUCT } from "../core/product";
import { UPDATE_CHECK_OPT_OUT } from "../core/updateNotice";

export interface CliOptions {
  command: "review" | "mcp" | "hook" | "sessions" | "cleanup" | "update" | "doctor";
  agent: "codex" | "claude-code" | undefined;
  spec: string | undefined; // ref spec; absent = working tree vs HEAD
  scope: string | undefined; // path scope for `browse`; ignored otherwise
  reviewId: string | undefined; // durable Review Record supplied by an integration
  port: number; // 0 = any free port
  open: boolean; // open the browser once serving
  yes: boolean; // cleanup/doctor: skip the confirmation prompt
  all: boolean; // cleanup: also stop active (not just finished/stale) sessions
  fix: boolean; // doctor: apply the repair plan
  check: boolean; // update: report whether a newer release exists, never download
  help: boolean;
  version: boolean;
}

export const USAGE = `${PRODUCT.name} — local git diff review with inline comments and LLM prompt export

Usage
  ${PRODUCT.name} [ref] [options]
  ${PRODUCT.name} mcp serve
  ${PRODUCT.name} hook stop --agent <codex|claude-code>
  ${PRODUCT.name} sessions
  ${PRODUCT.name} cleanup [--yes] [--all]
  ${PRODUCT.name} update [--check]
  ${PRODUCT.name} doctor [--fix] [--yes]

  (the deprecated \`${PRODUCT.legacyName}\` command and \`${PRODUCT.legacyEnvPrefix}*\` env vars still work for now)

Refs
  (none)            working tree vs HEAD, untracked files included
  staged            staged changes only
  <branch>          current branch vs <branch> (pr-style three-dot)
  <ref1>..<ref2>    commit range
  browse [path]     review the whole codebase (optionally scoped to a path)

Session commands
  sessions          list running ${PRODUCT.name} sessions (host, port, age, live/stale)
  cleanup           stop stale sessions and finished reviews
      --yes         skip the confirmation prompt
      --all         also stop active (not just finished/stale) sessions

Updates
  update            download and install the latest release
      --check       only report whether a newer release exists
  (a new release is announced at launch; set ${PRODUCT.envPrefix}${UPDATE_CHECK_OPT_OUT}=1 to silence it)

Diagnostics
  doctor            check the Claude Code plugin install for stale ${PRODUCT.legacyName} leftovers
      --fix         run the repair commands through the \`claude\` cli
      --yes         skip the confirmation prompt

Options
  -p, --port <n>    serve on a fixed port (default: any free port)
      --no-open     don't open the browser automatically
      --review-id   open an existing durable Review Record
  -v, --version     print the installed version
  -h, --help        show this help

Comments are saved to .review in the current directory and compile into a
structured review prompt from the UI.`;

const MAX_PORT = 65535;

type CommandFlag = "yes" | "all" | "fix" | "check";

// subcommand-only boolean flags: the option each sets and the commands that accept it.
const COMMAND_FLAGS: Record<string, { field: CommandFlag; commands: readonly CliOptions["command"][] }> = {
  "--yes": { field: "yes", commands: ["cleanup", "doctor"] },
  "--all": { field: "all", commands: ["cleanup"] },
  "--fix": { field: "fix", commands: ["doctor"] },
  "--check": { field: "check", commands: ["update"] },
};

// maps argv (already sliced past the runtime + script) into options.
// throws a user-facing message on unknown flags or a bad port.
export function parseCliArgs(argv: string[]): CliOptions {
  const args = [...argv];
  const command =
    args[0] === "mcp" ? "mcp" :
    args[0] === "hook" ? "hook" :
    args[0] === "sessions" ? "sessions" :
    args[0] === "cleanup" ? "cleanup" :
    args[0] === "update" ? "update" :
    args[0] === "doctor" ? "doctor" : "review";
  if (command === "mcp" || command === "hook") {
    args.shift();
    const subcommand = args.shift();
    if (command === "mcp" && subcommand !== "serve") throw new Error("mcp requires the serve command");
    if (command === "hook" && subcommand !== "stop") throw new Error("hook requires the stop command");
  } else if (command !== "review") {
    args.shift();
  }
  const opts: CliOptions = { command, agent: undefined, spec: undefined, scope: undefined, reviewId: undefined, port: 0, open: true, yes: false, all: false, fix: false, check: false, help: false, version: false };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i] as string;
    if (arg === "-h" || arg === "--help") opts.help = true;
    else if (arg === "-v" || arg === "--version") opts.version = true;
    else if (arg === "--no-open") opts.open = false;
    else if (Object.hasOwn(COMMAND_FLAGS, arg)) {
      const flag = COMMAND_FLAGS[arg]!;
      if (!flag.commands.includes(opts.command)) throw new Error(`unexpected argument: ${arg} (${opts.command} accepts options only)`);
      opts[flag.field] = true;
    }
    else if (arg === "--review-id") {
      const id = args[++i];
      if (!id) throw new Error("--review-id needs an id");
      opts.reviewId = id;
    }
    else if (arg === "--agent") {
      const agent = args[++i];
      if (agent !== "codex" && agent !== "claude-code") throw new Error("--agent must be codex or claude-code");
      opts.agent = agent;
    }
    else if (arg === "-p" || arg === "--port") {
      const raw = args[++i];
      const port = Number(raw);
      if (!raw || !Number.isInteger(port) || port < 1 || port > MAX_PORT) {
        throw new Error(`--port needs a number between 1 and ${MAX_PORT} (got ${raw ?? "nothing"})`);
      }
      opts.port = port;
    } else if (arg.startsWith("-")) {
      throw new Error(`unknown option: ${arg} (try --help)`);
    } else if (opts.command !== "review") {
      throw new Error(`unexpected argument: ${arg} (${opts.command} accepts options only)`);
    } else if (opts.spec === undefined) {
      opts.spec = arg;
    } else if (opts.spec === "browse" && opts.scope === undefined) {
      opts.scope = arg;
    } else {
      throw new Error(`unexpected argument: ${arg} (only one ref spec, try --help)`);
    }
  }
  return opts;
}
