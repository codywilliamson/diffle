// registry of coding agents diffle can wire itself into, plus install detection.

import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { PRODUCT, repositorySlug } from "./product";

export type PluginCli = "claude" | "codex";
// argv lists run as `<cli> ...args`, in order
export interface PluginIntegration { kind: "plugin"; cli: PluginCli; install: string[][]; remove: string[][]; }
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

  return [
    pluginTarget("claude", "Claude Code", home, {
      kind: "plugin", cli: "claude",
      install: [MARKETPLACE_ADD, ["plugin", "install", PLUGIN_REF, "--scope", "user"]],
      remove: [["plugin", "uninstall", PLUGIN_REF, "--scope", "user"]],
    }),
    pluginTarget("codex", "Codex", home, {
      kind: "plugin", cli: "codex",
      install: [MARKETPLACE_ADD, ["plugin", "add", PLUGIN_REF]],
      remove: [["plugin", "remove", PLUGIN_REF]],
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
