import { afterEach, expect, test } from "bun:test";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { mcpEntrySnippet, mergeMcpEntry, removeMcpEntry } from "../src/core/mcpConfigFile";
import { cleanupTempDirs, tempDir } from "./helpers/claudeConfig";

afterEach(cleanupTempDirs);

const ENTRY = { command: "diffle", args: ["mcp", "serve"] };
const read = (path: string) => readFileSync(path, "utf8");

test("creates a missing file with parent dirs", () => {
  const path = join(tempDir(), "a", "b", "mcp.json");
  expect(mergeMcpEntry(path, "mcpServers", "diffle", ENTRY)).toBe("created");
  expect(read(path)).toBe(JSON.stringify({ mcpServers: { diffle: ENTRY } }, null, 2) + "\n");
});

test("updates while preserving other keys and order", () => {
  const path = join(tempDir(), "s.json");
  writeFileSync(path, JSON.stringify({ theme: "dark", mcpServers: { other: { command: "x" } }, tail: 1 }));
  expect(mergeMcpEntry(path, "mcpServers", "diffle", ENTRY)).toBe("updated");
  const parsed = JSON.parse(read(path));
  expect(Object.keys(parsed)).toEqual(["theme", "mcpServers", "tail"]);
  expect(Object.keys(parsed.mcpServers)).toEqual(["other", "diffle"]);
});

test("adds the key when the root has none", () => {
  const path = join(tempDir(), "s.json");
  writeFileSync(path, '{"a":1}');
  expect(mergeMcpEntry(path, "mcp", "diffle", ENTRY)).toBe("updated");
  expect(JSON.parse(read(path))).toEqual({ a: 1, mcp: { diffle: ENTRY } });
});

test("replaces a stale entry, then reports unchanged without writing", () => {
  const path = join(tempDir(), "s.json");
  writeFileSync(path, JSON.stringify({ mcpServers: { diffle: { command: "old" } } }));
  expect(mergeMcpEntry(path, "mcpServers", "diffle", ENTRY)).toBe("updated");
  const before = read(path);
  expect(mergeMcpEntry(path, "mcpServers", "diffle", ENTRY)).toBe("unchanged");
  expect(read(path)).toBe(before);
});

test("preserves tab indentation and crlf", () => {
  const path = join(tempDir(), "s.json");
  writeFileSync(path, '{\r\n\t"a": 1\r\n}\r\n');
  mergeMcpEntry(path, "mcpServers", "diffle", ENTRY);
  const text = read(path);
  expect(text).toContain('\r\n\t"a": 1');
  expect(text.replace(/\r\n/g, "")).not.toContain("\n");
  expect(text.endsWith("\r\n")).toBe(true);
});

test.each([
  ["comments", '{\n  // hi\n  "a": 1\n}\n'],
  ["array root", "[1, 2]"],
  ["non-object key", '{"mcpServers": []}'],
  ["not json", "nope"],
])("skips and never rewrites: %s", (_label, body) => {
  const path = join(tempDir(), "s.json");
  writeFileSync(path, body);
  expect(mergeMcpEntry(path, "mcpServers", "diffle", ENTRY)).toBe("skipped");
  expect(removeMcpEntry(path, "mcpServers", "diffle")).toBe("skipped");
  expect(read(path)).toBe(body);
});

test("remove deletes the entry and keeps an empty key object", () => {
  const path = join(tempDir(), "s.json");
  writeFileSync(path, JSON.stringify({ x: 1, mcpServers: { diffle: ENTRY } }));
  expect(removeMcpEntry(path, "mcpServers", "diffle")).toBe("removed");
  expect(JSON.parse(read(path))).toEqual({ x: 1, mcpServers: {} });
});

test("remove reports not-found for missing file, key, or entry", () => {
  const dir = tempDir();
  expect(removeMcpEntry(join(dir, "none.json"), "mcpServers", "diffle")).toBe("not-found");
  expect(existsSync(join(dir, "none.json"))).toBe(false);
  const path = join(dir, "s.json");
  writeFileSync(path, '{"mcpServers":{"other":{}}}');
  expect(removeMcpEntry(path, "mcpServers", "diffle")).toBe("not-found");
  expect(removeMcpEntry(path, "servers", "diffle")).toBe("not-found");
});

test("snippet is pasteable json", () => {
  expect(JSON.parse(mcpEntrySnippet("mcpServers", "diffle", ENTRY))).toEqual({ mcpServers: { diffle: ENTRY } });
});
