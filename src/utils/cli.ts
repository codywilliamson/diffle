// cli argument parsing for the nittle entry point. pure — no io, fully unit-tested.


export { USAGE, helpFor } from "./usage";
import { COMMIT_SPEC_SUFFIX } from "./commitTarget";
import { COMPLETION_SHELLS, HOOK_AGENTS, HOOK_SUBCOMMANDS, MCP_ACTIONS, type CliCommand, type CompletionShell, type HookAgent, type McpAction } from "./cliVocabulary";
import { findFlag, flagAccepted } from "./cliFlags";

export type { McpAction };

export interface CliOptions {
  command: CliCommand;
  mcpAction: McpAction | undefined; // mcp only
  agent: HookAgent | undefined;
  spec: string | undefined; // ref spec; absent = working tree vs HEAD
  scope: string | undefined; // path scope for `browse`; ignored otherwise
  reviewId: string | undefined; // durable Review Record supplied by an integration
  port: number; // 0 = any free port
  open: boolean; // open the browser once serving
  wait: boolean; // review: block until the reviewer hands off, then print the result on stdout
  json: boolean; // review --wait: print the get_review structure instead of the prompt
  lsp: boolean; // start language servers for code navigation; --no-lsp turns it off
  yes: boolean; // cleanup/doctor/setup/mcp restart: skip the confirmation prompt
  all: boolean; // cleanup: also stop active (not just finished/stale) sessions
  fix: boolean; // doctor: apply the repair plan
  check: boolean; // update: report whether a newer release exists, never download
  remove: boolean; // setup: unwire instead of wire
  shell: CompletionShell | undefined; // completion only
  agents: string[] | undefined; // setup: agent ids to act on, skipping the prompt
  help: boolean;
  version: boolean;
  license: boolean;
}

const MAX_PORT = 65535;

type CommandFlag = "wait" | "json" | "yes" | "all" | "fix" | "check" | "remove";

// boolean flags: the option each sets. which commands accept them lives in cliFlags.ts.
const BOOLEAN_FIELDS: Record<string, CommandFlag> = {
  "--wait": "wait", "--json": "json", "--yes": "yes", "--all": "all", "--fix": "fix", "--check": "check", "--remove": "remove",
};

// maps argv (already sliced past the runtime + script) into options.
// throws a user-facing message on unknown flags or a bad port.
export function parseCliArgs(argv: string[]): CliOptions {
  const args = [...argv];
  const command =
    args[0] === "show" ? "show" :
    args[0] === "mcp" ? "mcp" :
    args[0] === "hook" ? "hook" :
    args[0] === "sessions" ? "sessions" :
    args[0] === "cleanup" ? "cleanup" :
    args[0] === "update" ? "update" :
    args[0] === "doctor" ? "doctor" :
    args[0] === "setup" ? "setup" :
    args[0] === "completion" ? "completion" : "review";
  const hasSubcommands = command === "mcp" || command === "hook";
  let subcommand: string | undefined;
  if (hasSubcommands) {
    args.shift();
    const helpOnly = args[0] === "-h" || args[0] === "--help"; // `mcp --help` needs no subcommand
    subcommand = helpOnly ? undefined : args.shift();
    if (!helpOnly && command === "mcp" && !MCP_ACTIONS.includes(subcommand as McpAction)) throw new Error(`mcp requires one of: ${MCP_ACTIONS.join(", ")}`);
    if (!helpOnly && command === "hook" && !HOOK_SUBCOMMANDS.includes(subcommand as (typeof HOOK_SUBCOMMANDS)[number])) throw new Error("hook requires the stop command");
  } else if (command !== "review") {
    args.shift();
  }
  const mcpAction = MCP_ACTIONS.find((action) => command === "mcp" && action === argv[1]);
  const opts: CliOptions = { command, mcpAction, agent: undefined, spec: undefined, scope: undefined, reviewId: undefined, port: 0, open: true, wait: false, json: false, lsp: true, yes: false, all: false, fix: false, check: false, remove: false, shell: undefined, agents: undefined, help: false, version: false, license: false };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i] as string;
    if (arg.startsWith("-")) {
      const spec = findFlag(arg);
      if (!spec) throw new Error(`unknown option: ${arg} (try --help)`);
      if (!flagAccepted(spec, opts.command, hasSubcommands, subcommand)) {
        const only = hasSubcommands && spec.subcommands && spec.commands.includes(opts.command);
        throw new Error(only ? `unexpected argument: ${arg} (only ${opts.command} ${spec.subcommands!.join("/")} accepts it)` : `unexpected argument: ${arg} (${opts.command} accepts options only)`);
      }
    }
    if (arg === "-h" || arg === "--help") opts.help = true;
    else if (arg === "-v" || arg === "--version") opts.version = true;
    else if (arg === "--license") opts.license = true;
    else if (arg === "--no-open") opts.open = false;
    else if (arg === "--no-lsp") opts.lsp = false;
    else if (Object.hasOwn(BOOLEAN_FIELDS, arg)) opts[BOOLEAN_FIELDS[arg]!] = true;
    else if (arg === "--agents") {
      const list = args[++i];
      const ids = (list ?? "").split(",").map((id) => id.trim()).filter(Boolean);
      if (ids.length === 0) throw new Error("--agents needs a comma-separated list of agent ids");
      opts.agents = ids;
    }
    else if (arg === "--shell") {
      const shell = args[++i];
      if (!COMPLETION_SHELLS.includes(shell as CompletionShell)) throw new Error(`--shell must be one of: ${COMPLETION_SHELLS.join(", ")}`);
      opts.shell = shell as CompletionShell;
    }
    else if (arg === "--review-id") {
      const id = args[++i];
      if (!id) throw new Error("--review-id needs an id");
      opts.reviewId = id;
    }
    else if (arg === "--agent") {
      const agent = args[++i];
      if (!HOOK_AGENTS.includes(agent as HookAgent)) throw new Error("--agent must be codex or claude-code");
      opts.agent = agent as HookAgent;
    }
    else if (arg === "-p" || arg === "--port") {
      const raw = args[++i];
      const port = Number(raw);
      if (!raw || !Number.isInteger(port) || port < 1 || port > MAX_PORT) {
        throw new Error(`--port needs a number between 1 and ${MAX_PORT} (got ${raw ?? "nothing"})`);
      }
      opts.port = port;
    } else if (opts.command !== "review" && opts.command !== "show") {
      throw new Error(`unexpected argument: ${arg} (${opts.command} accepts options only)`);
    } else if (opts.spec === undefined) {
      opts.spec = arg;
    } else if (opts.command === "review" && opts.spec === "browse" && opts.scope === undefined) {
      opts.scope = arg;
    } else {
      throw new Error(`unexpected argument: ${arg} (only one ref spec, try --help)`);
    }
  }
  if (opts.command === "show") opts.spec = `${opts.spec ?? "HEAD"}${COMMIT_SPEC_SUFFIX}`;
  if (opts.json && !opts.wait) throw new Error("--json needs --wait");
  return opts;
}
