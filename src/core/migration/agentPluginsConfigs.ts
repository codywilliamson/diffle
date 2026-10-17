// inspects and rewrites the config files that can still launch a retired (diffle / loupe) mcp
// server: the json configs of the mcp-config agents and codex's config.toml.

import { existsSync, readFileSync } from "node:fs";
import type { AgentTarget } from "../agentTargets";
import { rewriteMcpServers, writeTextAtomic } from "../mcpConfigFile";
import { PRODUCT } from "../product";
import { hasLegacyServer, rewriteLegacyServers } from "./agentPluginsJson";
import { hasLegacyToml, rewriteLegacyToml } from "./agentPluginsToml";

// "unreadable" = the file mentions a retired identity but can't be edited safely (comments, odd shape)
export type ConfigState = "clean" | "legacy" | "unreadable";
export type ConfigRewrite = "rewritten" | "unchanged" | "unreadable";

const RETIRED_QUOTED = new RegExp(`["'](?:[^"']*[\\\\/])?(?:${PRODUCT.retiredNames.join("|")})(?:-review|-mcp)?(?:\\.exe)?["']`, "i");

type Json = Record<string, unknown>;

function readText(path: string): string | undefined {
  if (!existsSync(path)) return undefined;
  try { return readFileSync(path, "utf8"); } catch { return ""; }
}

function parseServers(text: string, key: string): Json | undefined | "bad" {
  try {
    const root: unknown = JSON.parse(text);
    if (root === null || typeof root !== "object" || Array.isArray(root)) return "bad";
    const servers = (root as Json)[key];
    if (servers === undefined) return undefined;
    return servers !== null && typeof servers === "object" && !Array.isArray(servers) ? (servers as Json) : "bad";
  } catch {
    return "bad";
  }
}

function jsonState(path: string, key: string): ConfigState {
  const text = readText(path);
  if (text === undefined) return "clean";
  const servers = parseServers(text, key);
  if (servers === "bad") return RETIRED_QUOTED.test(text) ? "unreadable" : "clean";
  return servers && hasLegacyServer(servers) ? "legacy" : "clean";
}

function tomlState(path: string): ConfigState {
  const text = readText(path);
  return text !== undefined && hasLegacyToml(text) ? "legacy" : "clean";
}

function isCodexToml(target: AgentTarget): boolean {
  return target.integration.kind === "plugin" && target.integration.registry.endsWith(".toml");
}

export function configState(target: AgentTarget): ConfigState {
  const { integration } = target;
  if (integration.kind === "mcp-config") return jsonState(integration.path, integration.key);
  return isCodexToml(target) ? tomlState(integration.registry) : "clean";
}

export function configPath(target: AgentTarget): string | undefined {
  const { integration } = target;
  return integration.kind === "mcp-config" ? integration.path : isCodexToml(target) ? integration.registry : undefined;
}

export function rewriteConfig(target: AgentTarget, command: string): ConfigRewrite {
  const { integration } = target;
  if (integration.kind === "mcp-config") {
    const action = rewriteMcpServers(integration.path, integration.key, (servers) => rewriteLegacyServers(servers, command));
    return action === "skipped" ? "unreadable" : action === "updated" ? "rewritten" : "unchanged";
  }
  if (!isCodexToml(target)) return "unchanged";
  const text = readText(integration.registry);
  if (text === undefined) return "unchanged";
  const next = rewriteLegacyToml(text, command);
  if (next === text) return "unchanged";
  writeTextAtomic(integration.registry, next);
  return "rewritten";
}
