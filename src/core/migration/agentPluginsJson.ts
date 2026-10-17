// rewrites retired (diffle / loupe) server entries inside a json mcp config's servers object.

import { isDeepStrictEqual } from "node:util";
import { MCP_ARGS } from "../agentTargets";
import { PRODUCT } from "../product";
import { isRetiredCommand, isRetiredServerName, needsServeArgs } from "./retiredCommand";

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json => value !== null && typeof value === "object" && !Array.isArray(value);

function rewriteCommand(entry: Json, command: string): Json {
  const current = entry.command;
  if (Array.isArray(current) && typeof current[0] === "string") {
    if (!isRetiredCommand(current[0])) return entry;
    return { ...entry, command: needsServeArgs(current[0]) ? [command, ...MCP_ARGS] : [command, ...current.slice(1)] };
  }
  if (typeof current !== "string" || !isRetiredCommand(current)) return entry;
  return { ...entry, command, args: needsServeArgs(current) && !Array.isArray(entry.args) ? MCP_ARGS : entry.args ?? MCP_ARGS };
}

const isLegacyEntry = (name: string, entry: unknown): boolean =>
  isRetiredServerName(name) ||
  (isObject(entry) && (Array.isArray(entry.command) ? isRetiredCommand(String(entry.command[0])) : isRetiredCommand(entry.command as string | undefined)));

export const hasLegacyServer = (servers: Json): boolean => Object.entries(servers).some(([name, entry]) => isLegacyEntry(name, entry));

// order is preserved; a retired name becomes `nittle`, unless a `nittle` entry already exists (it wins)
export function rewriteLegacyServers(servers: Json, command: string): Json | undefined {
  if (!hasLegacyServer(servers)) return undefined;
  const result: Json = {};
  for (const [name, entry] of Object.entries(servers)) {
    const renamed = isRetiredServerName(name) ? PRODUCT.name : name;
    if (renamed !== name && renamed in servers) continue;
    result[renamed] = isObject(entry) ? rewriteCommand(entry, command) : entry;
  }
  return isDeepStrictEqual(result, servers) ? undefined : result;
}
