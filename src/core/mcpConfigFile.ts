// idempotent json merge/remove of one mcp server entry. files that are not plain json objects
// (comments, arrays, odd shapes) are never rewritten — callers show `mcpEntrySnippet` instead.

import {
  chmodSync, existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync, realpathSync, renameSync, rmSync, statSync, writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";

export type ConfigAction = "created" | "updated" | "unchanged" | "removed" | "not-found" | "skipped";

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const DEFAULT_INDENT = "  ";
const PERMISSION_BITS = 0o777;
const NEW_FILE_MODE = 0o600;

function detectIndent(text: string): string {
  return /^([ \t]+)"/m.exec(text)?.[1] ?? DEFAULT_INDENT;
}

export const isMissingFile = (err: unknown): boolean => (err as NodeJS.ErrnoException | undefined)?.code === "ENOENT";

// the real file behind a symlink, including a dangling one whose target doesn't exist yet
function writeTarget(path: string): string {
  try {
    if (!lstatSync(path).isSymbolicLink()) return path;
  } catch {
    return path;
  }
  return existsSync(path) ? realpathSync(path) : resolve(dirname(path), readlinkSync(path));
}

function writeJson(path: string, data: Json, original = ""): void {
  const eol = original.includes("\r\n") ? "\r\n" : "\n";
  const body = JSON.stringify(data, null, detectIndent(original)).replace(/\n/g, eol);
  // write a sibling then rename, so a failed or interrupted write never truncates the real config.
  // a symlink is followed (the link survives) and the file's mode is kept (configs can hold secrets)
  const target = writeTarget(path);
  mkdirSync(dirname(target), { recursive: true });
  const mode = existsSync(target) ? statSync(target).mode & PERMISSION_BITS : NEW_FILE_MODE;
  const staged = `${target}.${process.pid}.tmp`;
  try {
    writeFileSync(staged, body + eol, { mode });
    chmodSync(staged, mode); // writeFileSync's mode is masked by the umask
    renameSync(staged, target);
  } finally {
    rmSync(staged, { force: true });
  }
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

// read-only check; a file that can't be parsed counts when it mentions the name at all, and one
// that exists but can't be read counts too, so a teardown that can't confirm removal fails safe
export function hasMcpEntry(path: string, key: string, name: string): boolean {
  try {
    const text = readFileSync(path, "utf8");
    const root = parseObject(text);
    if (!root) return text.includes(JSON.stringify(name));
    const servers = root[key];
    return isObject(servers) && name in servers;
  } catch (err) {
    return !isMissingFile(err);
  }
}

export function removeMcpEntry(path: string, key: string, name: string): ConfigAction {
  if (!existsSync(path)) return "not-found";
  const text = readFileSync(path, "utf8");
  const root = parseObject(text);
  // can't edit it; report not-found once the name is gone so a hand edit clears the teardown
  if (!root) return text.includes(JSON.stringify(name)) ? "skipped" : "not-found";
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
