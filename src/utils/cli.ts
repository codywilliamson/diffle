// cli argument parsing for the diffle entry point. pure — no io, fully unit-tested.


export { USAGE, helpFor } from "./usage";

const MCP_ACTIONS = ["serve", "list", "restart"] as const;
export type McpAction = (typeof MCP_ACTIONS)[number];

export interface CliOptions {
  command: "review" | "mcp" | "hook" | "sessions" | "cleanup" | "update" | "doctor" | "setup";
  mcpAction: McpAction | undefined; // mcp only
  agent: "codex" | "claude-code" | undefined;
  spec: string | undefined; // ref spec; absent = working tree vs HEAD
  scope: string | undefined; // path scope for `browse`; ignored otherwise
  reviewId: string | undefined; // durable Review Record supplied by an integration
  port: number; // 0 = any free port
  open: boolean; // open the browser once serving
  yes: boolean; // cleanup/doctor/setup/mcp restart: skip the confirmation prompt
  all: boolean; // cleanup: also stop active (not just finished/stale) sessions
  fix: boolean; // doctor: apply the repair plan
  check: boolean; // update: report whether a newer release exists, never download
  remove: boolean; // setup: unwire instead of wire
  agents: string[] | undefined; // setup: agent ids to act on, skipping the prompt
  help: boolean;
  version: boolean;
  license: boolean;
}

const MAX_PORT = 65535;

type CommandFlag = "yes" | "all" | "fix" | "check" | "remove";

// subcommand-only boolean flags: the option each sets and the commands that accept it.
const COMMAND_FLAGS: Record<string, { field: CommandFlag; commands: readonly CliOptions["command"][] }> = {
  "--yes": { field: "yes", commands: ["cleanup", "doctor", "setup", "mcp"] },
  "--all": { field: "all", commands: ["cleanup"] },
  "--fix": { field: "fix", commands: ["doctor"] },
  "--check": { field: "check", commands: ["update"] },
  "--remove": { field: "remove", commands: ["setup"] },
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
    args[0] === "doctor" ? "doctor" :
    args[0] === "setup" ? "setup" : "review";
  if (command === "mcp" || command === "hook") {
    args.shift();
    const helpOnly = args[0] === "-h" || args[0] === "--help"; // `mcp --help` needs no subcommand
    const subcommand = helpOnly ? undefined : args.shift();
    if (!helpOnly && command === "mcp" && !MCP_ACTIONS.includes(subcommand as McpAction)) throw new Error(`mcp requires one of: ${MCP_ACTIONS.join(", ")}`);
    if (!helpOnly && command === "hook" && subcommand !== "stop") throw new Error("hook requires the stop command");
  } else if (command !== "review") {
    args.shift();
  }
  const mcpAction = MCP_ACTIONS.find((action) => command === "mcp" && action === argv[1]);
  const opts: CliOptions = { command, mcpAction, agent: undefined, spec: undefined, scope: undefined, reviewId: undefined, port: 0, open: true, yes: false, all: false, fix: false, check: false, remove: false, agents: undefined, help: false, version: false, license: false };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i] as string;
    if (arg === "-h" || arg === "--help") opts.help = true;
    else if (arg === "-v" || arg === "--version") opts.version = true;
    else if (arg === "--license") opts.license = true;
    else if (arg === "--no-open") opts.open = false;
    else if (Object.hasOwn(COMMAND_FLAGS, arg)) {
      const flag = COMMAND_FLAGS[arg]!;
      if (!flag.commands.includes(opts.command)) throw new Error(`unexpected argument: ${arg} (${opts.command} accepts options only)`);
      opts[flag.field] = true;
    }
    else if (arg === "--agents") {
      const list = args[++i];
      if (opts.command !== "setup") throw new Error(`unexpected argument: ${arg} (${opts.command} accepts options only)`);
      const ids = (list ?? "").split(",").map((id) => id.trim()).filter(Boolean);
      if (ids.length === 0) throw new Error("--agents needs a comma-separated list of agent ids");
      opts.agents = ids;
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
  if (opts.yes && opts.command === "mcp" && opts.mcpAction !== "restart") throw new Error("unexpected argument: --yes (only mcp restart accepts it)");
  return opts;
}
