// idempotent json merge/remove of one mcp server entry. files that are not plain json objects
// (comments, arrays, odd shapes) are never rewritten — callers show `mcpEntrySnippet` instead.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { isDeepStrictEqual } from "node:util";

export type ConfigAction = "created" | "updated" | "unchanged" | "removed" | "not-found" | "skipped";

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const DEFAULT_INDENT = "  ";

function detectIndent(text: string): string {
  return /^([ \t]+)"/m.exec(text)?.[1] ?? DEFAULT_INDENT;
}

function writeJson(path: string, data: Json, original = ""): void {
  const eol = original.includes("\r\n") ? "\r\n" : "\n";
  const body = JSON.stringify(data, null, detectIndent(original)).replace(/\n/g, eol);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, body + eol);
}

function parseObject(text: string): Json | undefined {
  try {
    const parsed: unknown = JSON.parse(text);
    return isObject(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export function mergeMcpEntry(path: string, key: string, name: string, entry: Record<string, unknown>): ConfigAction {
  if (!existsSync(path)) {
    writeJson(path, { [key]: { [name]: entry } });
    return "created";
  }
  const text = readFileSync(path, "utf8");
  const root = parseObject(text);
  if (!root) return "skipped";
  const servers = key in root ? root[key] : {};
  if (!isObject(servers)) return "skipped";
  if (isDeepStrictEqual(servers[name], entry)) return "unchanged";
  root[key] = { ...servers, [name]: entry };
  writeJson(path, root, text);
  return "updated";
}

export function removeMcpEntry(path: string, key: string, name: string): ConfigAction {
  if (!existsSync(path)) return "not-found";
  const text = readFileSync(path, "utf8");
  const root = parseObject(text);
  if (!root) return "skipped";
  const servers = root[key];
  if (!isObject(servers)) return key in root ? "skipped" : "not-found";
  if (!(name in servers)) return "not-found";
  delete servers[name];
  writeJson(path, root, text);
  return "removed";
}

// what to paste by hand when a file was skipped
export function mcpEntrySnippet(key: string, name: string, entry: Record<string, unknown>): string {
  return JSON.stringify({ [key]: { [name]: entry } }, null, DEFAULT_INDENT);
}
