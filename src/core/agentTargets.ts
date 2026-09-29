// registry of coding agents diffle can wire itself into, plus install detection.

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { hasOurMarketplace } from "./marketplaceState";
import { hasMcpEntry, isMissingFile } from "./mcpConfigFile";
import { PRODUCT, repositorySlug } from "./product";

export type PluginCli = "claude" | "codex";
// argv lists run as `<cli> ...args`, in order; registry = the agent's file listing installed plugins,
// marketplaceSources = the files that can register a marketplace (see marketplaceState)
export interface PluginIntegration {
  kind: "plugin"; cli: PluginCli; install: string[][]; remove: string[][]; registry: string; marketplaceSources: string[];
}
// key = top-level object holding servers
export interface McpConfigIntegration { kind: "mcp-config"; path: string; key: string; entry: Record<string, unknown>; }
export type AgentIntegration = PluginIntegration | McpConfigIntegration;
export interface AgentTarget { id: string; displayName: string; binary?: string; configDir?: string; integration: AgentIntegration; }
// command = what agents launch; defaults to serverCommand()
export interface AgentEnv { home: string; platform: NodeJS.Platform; env: Record<string, string | undefined>; command?: string; }

export const MCP_SERVER_NAME: string = PRODUCT.name;

const MCP_ARGS = ["mcp", "serve"];
const PLUGIN_REF = `${PRODUCT.plugin.name}@${PRODUCT.plugin.marketplace}`;
const MARKETPLACE_ADD = ["plugin", "marketplace", "add", repositorySlug()];
const MARKETPLACE_REMOVE = ["plugin", "marketplace", "remove", PRODUCT.plugin.marketplace];

// gui-launched agents don't source shell rc files, so the installed binary is written by
// absolute path; running from source (or the legacy alias) falls back to the bare name.
export function serverCommand(execPath = process.execPath): string {
  return basename(execPath).toLowerCase().startsWith(PRODUCT.name) ? execPath : PRODUCT.name;
}

function defaultEnv(): AgentEnv {
  return { home: homedir(), platform: process.platform, env: process.env };
}

interface McpSpec { id: string; displayName: string; binary: string; dir: string; file: string; key: string; entry: Record<string, unknown>; }

function mcpTarget(spec: McpSpec): AgentTarget {
  const { id, displayName, binary, dir, file, key, entry } = spec;
  return { id, displayName, binary, configDir: dir, integration: { kind: "mcp-config", path: join(dir, file), key, entry } };
}

function pluginTarget(id: string, displayName: string, home: string, integration: PluginIntegration): AgentTarget {
  return { id, displayName, binary: integration.cli, configDir: join(home, `.${id}`), integration };
}

export function agentTargets(agentEnv: AgentEnv = defaultEnv()): AgentTarget[] {
  const { home, platform, env, command = serverCommand() } = agentEnv;
  const commandEntry = { command, args: MCP_ARGS };
  const xdg = env.XDG_CONFIG_HOME || join(home, ".config");
  const appData = env.APPDATA || join(home, "AppData", "Roaming");
  const vscodeDir = platform === "win32" ? join(appData, "Code", "User")
    : platform === "darwin" ? join(home, "Library", "Application Support", "Code", "User")
    : join(xdg, "Code", "User");
  const zedDir = platform === "win32" ? join(appData, "Zed") : join(xdg, "zed");
  const opencodeDir = join(xdg, "opencode");
  const opencodeFile = existsSync(join(opencodeDir, "opencode.jsonc")) ? "opencode.jsonc" : "opencode.json";
  const claudeDir = env.CLAUDE_CONFIG_DIR || join(home, ".claude");
  const codexConfig = join(env.CODEX_HOME || join(home, ".codex"), "config.toml");

  return [
    pluginTarget("claude", "Claude Code", home, {
      kind: "plugin", cli: "claude",
      install: [MARKETPLACE_ADD, ["plugin", "install", PLUGIN_REF, "--scope", "user"]],
      remove: [["plugin", "uninstall", PLUGIN_REF, "--scope", "user"], MARKETPLACE_REMOVE],
      registry: join(claudeDir, "plugins", "installed_plugins.json"),
      marketplaceSources: [join(claudeDir, "plugins", "known_marketplaces.json"), join(claudeDir, "settings.json")],
    }),
    pluginTarget("codex", "Codex", home, {
      kind: "plugin", cli: "codex",
      install: [MARKETPLACE_ADD, ["plugin", "add", PLUGIN_REF]],
      remove: [["plugin", "remove", PLUGIN_REF], MARKETPLACE_REMOVE],
      registry: codexConfig,
      marketplaceSources: [codexConfig],
    }),
    mcpTarget({ id: "cursor", displayName: "Cursor", binary: "cursor", dir: join(home, ".cursor"), file: "mcp.json", key: "mcpServers", entry: commandEntry }),
    mcpTarget({ id: "gemini", displayName: "Gemini CLI", binary: "gemini", dir: join(home, ".gemini"), file: "settings.json", key: "mcpServers", entry: commandEntry }),
    mcpTarget({ id: "vscode", displayName: "VS Code", binary: "code", dir: vscodeDir, file: "mcp.json", key: "servers", entry: { type: "stdio", ...commandEntry } }),
    mcpTarget({ id: "windsurf", displayName: "Windsurf", binary: "windsurf", dir: join(home, ".codeium", "windsurf"), file: "mcp_config.json", key: "mcpServers", entry: commandEntry }),
    mcpTarget({ id: "opencode", displayName: "OpenCode", binary: "opencode", dir: opencodeDir, file: opencodeFile, key: "mcp", entry: { type: "local", command: [command, ...MCP_ARGS], enabled: true } }),
    mcpTarget({ id: "zed", displayName: "Zed", binary: "zed", dir: zedDir, file: "settings.json", key: "context_servers", entry: { source: "custom", ...commandEntry } }),
    mcpTarget({ id: "copilot", displayName: "GitHub Copilot CLI", binary: "copilot", dir: join(home, ".copilot"), file: "mcp-config.json", key: "mcpServers", entry: { type: "local", ...commandEntry, tools: ["*"] } }),
  ];
}

export function isDetected(
  target: AgentTarget,
  which: (bin: string) => string | null = (bin) => Bun.which(bin),
  exists: (path: string) => boolean = existsSync,
): boolean {
  return (!!target.binary && !!which(target.binary)) || (!!target.configDir && exists(target.configDir));
}

// whether diffle is currently wired into this agent. the quoted plugin ref matches both claude's
// json registry key and codex's `[plugins."…"]` toml table
export function isRegistered({ integration }: AgentTarget): boolean {
  if (integration.kind === "mcp-config") return hasMcpEntry(integration.path, integration.key, MCP_SERVER_NAME);
  // a marketplace left behind by a half-finished teardown still counts, so a rerun picks it up
  return isPluginInstalled(integration) || isMarketplaceRegistered(integration);
}

// unreadable counts as installed so a teardown that can't confirm removal fails safe
export function isPluginInstalled({ registry }: PluginIntegration): boolean {
  try {
    return readFileSync(registry, "utf8").includes(JSON.stringify(PLUGIN_REF));
  } catch (err) {
    return !isMissingFile(err);
  }
}

// a marketplace of the same name pointing elsewhere isn't ours to remove; unknown fails safe
export function isMarketplaceRegistered({ marketplaceSources }: PluginIntegration): boolean {
  return hasOurMarketplace(marketplaceSources);
}
