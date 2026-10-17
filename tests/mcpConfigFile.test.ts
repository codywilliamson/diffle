import { afterEach, expect, test } from "bun:test";
import { chmodSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { hasMcpEntry, mcpEntrySnippet, mergeMcpEntry, removeMcpEntry, type ConfigAction } from "../src/core/mcpConfigFile";
import { cleanupTempDirs, tempDir } from "./helpers/claudeConfig";

afterEach(cleanupTempDirs);

const ENTRY = { command: "nittle", args: ["mcp", "serve"] };
const read = (path: string) => readFileSync(path, "utf8");

test("creates a missing file with parent dirs", () => {
  const path = join(tempDir(), "a", "b", "mcp.json");
  expect(mergeMcpEntry(path, "mcpServers", "nittle", ENTRY)).toBe("created");
  expect(read(path)).toBe(JSON.stringify({ mcpServers: { nittle: ENTRY } }, null, 2) + "\n");
});

test("updates while preserving other keys and order", () => {
  const path = join(tempDir(), "s.json");
  writeFileSync(path, JSON.stringify({ theme: "dark", mcpServers: { other: { command: "x" } }, tail: 1 }));
  expect(mergeMcpEntry(path, "mcpServers", "nittle", ENTRY)).toBe("updated");
  const parsed = JSON.parse(read(path));
  expect(Object.keys(parsed)).toEqual(["theme", "mcpServers", "tail"]);
  expect(Object.keys(parsed.mcpServers)).toEqual(["other", "nittle"]);
});

test("adds the key when the root has none", () => {
  const path = join(tempDir(), "s.json");
  writeFileSync(path, '{"a":1}');
  expect(mergeMcpEntry(path, "mcp", "nittle", ENTRY)).toBe("updated");
  expect(JSON.parse(read(path))).toEqual({ a: 1, mcp: { nittle: ENTRY } });
});

test("replaces a stale entry, then reports unchanged without writing", () => {
  const path = join(tempDir(), "s.json");
  writeFileSync(path, JSON.stringify({ mcpServers: { nittle: { command: "old" } } }));
  expect(mergeMcpEntry(path, "mcpServers", "nittle", ENTRY)).toBe("updated");
  const before = read(path);
  expect(mergeMcpEntry(path, "mcpServers", "nittle", ENTRY)).toBe("unchanged");
  expect(read(path)).toBe(before);
});

test("preserves tab indentation and crlf", () => {
  const path = join(tempDir(), "s.json");
  writeFileSync(path, '{\r\n\t"a": 1\r\n}\r\n');
  mergeMcpEntry(path, "mcpServers", "nittle", ENTRY);
  const text = read(path);
  expect(text).toContain('\r\n\t"a": 1');
  expect(text.replace(/\r\n/g, "")).not.toContain("\n");
  expect(text.endsWith("\r\n")).toBe(true);
});

test.each<[string, string, ConfigAction]>([
  ["comments", '{\n  // hi\n  "a": 1\n}\n', "not-found"],
  ["comments with the entry", '{\n  // hi\n  "mcpServers": { "nittle": {} }\n}\n', "skipped"],
  ["array root", "[1, 2]", "not-found"],
  ["non-object key", '{"mcpServers": []}', "skipped"],
  ["not json", "nope", "not-found"],
])("skips and never rewrites: %s", (_label, body, removal) => {
  const path = join(tempDir(), "s.json");
  writeFileSync(path, body);
  expect(mergeMcpEntry(path, "mcpServers", "nittle", ENTRY)).toBe("skipped");
  expect(removeMcpEntry(path, "mcpServers", "nittle")).toBe(removal);
  expect(read(path)).toBe(body);
});

const posixOnly = test.skipIf(process.platform === "win32");

posixOnly("rewrites keep a restrictive mode and new files are owner-only", () => {
  const dir = tempDir();
  const path = join(dir, "s.json");
  writeFileSync(path, JSON.stringify({ x: 1 }));
  chmodSync(path, 0o600);
  mergeMcpEntry(path, "mcpServers", "nittle", ENTRY);
  expect(statSync(path).mode & 0o777).toBe(0o600);
  const created = join(dir, "new", "n.json");
  mergeMcpEntry(created, "mcpServers", "nittle", ENTRY);
  expect(statSync(created).mode & 0o777).toBe(0o600);
});

posixOnly("a symlinked config keeps its link and updates the target", () => {
  const dir = tempDir();
  const real = join(dir, "dotfiles.json");
  const link = join(dir, "s.json");
  writeFileSync(real, JSON.stringify({ x: 1 }));
  symlinkSync(real, link);
  expect(mergeMcpEntry(link, "mcpServers", "nittle", ENTRY)).toBe("updated");
  expect(lstatSync(link).isSymbolicLink()).toBe(true);
  expect(JSON.parse(read(real)).mcpServers.nittle).toEqual(ENTRY);
});

posixOnly("a dangling symlink keeps its link and creates the target", () => {
  const dir = tempDir();
  const real = join(dir, "dotfiles", "s.json");
  const link = join(dir, "s.json");
  symlinkSync(real, link);
  expect(mergeMcpEntry(link, "mcpServers", "nittle", ENTRY)).toBe("created");
  expect(lstatSync(link).isSymbolicLink()).toBe(true);
  expect(JSON.parse(read(real)).mcpServers.nittle).toEqual(ENTRY);
});

test("hasMcpEntry: missing is false, unreadable counts as present", () => {
  const dir = tempDir();
  expect(hasMcpEntry(join(dir, "none.json"), "mcpServers", "nittle")).toBe(false);
  mkdirSync(join(dir, "dir.json"));
  expect(hasMcpEntry(join(dir, "dir.json"), "mcpServers", "nittle")).toBe(true);
});

test("writes leave no staged temp file behind", () => {
  const dir = tempDir();
  const path = join(dir, "s.json");
  writeFileSync(path, JSON.stringify({ x: 1 }));
  expect(mergeMcpEntry(path, "mcpServers", "nittle", ENTRY)).toBe("updated");
  expect(readdirSync(dir)).toEqual(["s.json"]);
});

test("remove deletes the entry and keeps an empty key object", () => {
  const path = join(tempDir(), "s.json");
  writeFileSync(path, JSON.stringify({ x: 1, mcpServers: { nittle: ENTRY } }));
  expect(removeMcpEntry(path, "mcpServers", "nittle")).toBe("removed");
  expect(JSON.parse(read(path))).toEqual({ x: 1, mcpServers: {} });
});

test("remove reports not-found for missing file, key, or entry", () => {
  const dir = tempDir();
  expect(removeMcpEntry(join(dir, "none.json"), "mcpServers", "nittle")).toBe("not-found");
  expect(existsSync(join(dir, "none.json"))).toBe(false);
  const path = join(dir, "s.json");
  writeFileSync(path, '{"mcpServers":{"other":{}}}');
  expect(removeMcpEntry(path, "mcpServers", "nittle")).toBe("not-found");
  expect(removeMcpEntry(path, "servers", "nittle")).toBe("not-found");
});

test("snippet is pasteable json", () => {
  expect(JSON.parse(mcpEntrySnippet("mcpServers", "nittle", ENTRY))).toEqual({ mcpServers: { nittle: ENTRY } });
});
