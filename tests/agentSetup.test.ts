import { afterEach, expect, test } from "bun:test";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { applyAgent, pluginStepArgs, type RunCommand } from "../src/core/agentSetup";
import { agentTargets, MCP_SERVER_NAME, type AgentTarget } from "../src/core/agentTargets";
import { cleanupTempDirs, tempDir } from "./helpers/claudeConfig";

afterEach(cleanupTempDirs);

const byId = (home: string, id: string): AgentTarget =>
  agentTargets({ home, platform: "linux", env: {} }).find((t) => t.id === id)!;

function recorder(exitFor: (args: string[]) => number = () => 0) {
  const calls: string[][] = [];
  const run: RunCommand = (cli, args) => { calls.push([cli, ...args]); return exitFor(args); };
  return { calls, run };
}

test("claude install appends --yes only when asked", () => {
  const withYes = recorder();
  applyAgent(byId("/h", "claude"), "install", true, withYes.run);
  expect(withYes.calls[0]).not.toContain("--yes");
  expect(withYes.calls[1]).toContain("install");
  expect(withYes.calls[1]!.at(-1)).toBe("--yes");

  const without = recorder();
  applyAgent(byId("/h", "claude"), "install", false, without.run);
  expect(without.calls[1]).not.toContain("--yes");
});

test("codex never gets --yes", () => {
  const { calls, run } = recorder();
  applyAgent(byId("/h", "codex"), "install", true, run);
  expect(calls.flat()).not.toContain("--yes");
  expect(pluginStepArgs("codex", ["plugin", "install", "x"], true)).toEqual(["plugin", "install", "x"]);
});

test("a failing marketplace add is tolerated", () => {
  const { calls, run } = recorder((args) => (args[1] === "marketplace" ? 1 : 0));
  const results = applyAgent(byId("/h", "claude"), "install", false, run);
  expect(results.map((r) => r.status)).toEqual(["skipped", "ok"]);
  expect(calls).toHaveLength(2);
});

test("a failing install is reported and counted", () => {
  const { run } = recorder((args) => (args[1] === "install" ? 2 : 0));
  const results = applyAgent(byId("/h", "claude"), "install", false, run);
  expect(results.at(-1)).toMatchObject({ status: "failed" });
});

test("a failing uninstall is reported", () => {
  const { calls, run } = recorder(() => 1);
  const results = applyAgent(byId("/h", "claude"), "remove", true, run);
  expect(results).toEqual([expect.objectContaining({ status: "failed" })]);
  expect(calls[0]).toContain("uninstall");
});

test("remove also drops the marketplace, tolerating one that's already gone", () => {
  const { calls, run } = recorder((args) => (args[1] === "marketplace" ? 1 : 0));
  const results = applyAgent(byId("/h", "codex"), "remove", false, run);
  expect(calls.map((call) => call.slice(1, 3))).toEqual([["plugin", "remove"], ["plugin", "marketplace"]]);
  expect(results.map((r) => r.status)).toEqual(["ok", "skipped"]);
  expect(results[1]!.text).toContain("already removed");
});

test("mcp-config install then remove on a real file", () => {
  const home = tempDir();
  const cursor = byId(home, "cursor");
  const path = join(home, ".cursor", "mcp.json");
  expect(applyAgent(cursor, "install", true)[0]).toMatchObject({ status: "ok", text: `created → ${path}` });
  expect(JSON.parse(readFileSync(path, "utf8")).mcpServers[MCP_SERVER_NAME]).toBeDefined();
  expect(applyAgent(cursor, "install", true)[0]!.text).toStartWith("unchanged");
  expect(applyAgent(cursor, "remove", true)[0]!.text).toStartWith("removed");
  expect(applyAgent(cursor, "remove", true)[0]).toMatchObject({ status: "skipped" });
});

test("non-json config is skipped with a snippet, never rewritten", () => {
  const home = tempDir();
  const zed = byId(home, "zed");
  if (zed.integration.kind !== "mcp-config") throw new Error("expected mcp-config");
  const { path } = zed.integration;
  const original = '// zed\n{ "theme": "x" }\n';
  Bun.spawnSync({ cmd: ["node", "-e", `require("fs").mkdirSync(require("path").dirname(${JSON.stringify(path)}),{recursive:true})`] });
  writeFileSync(path, original);
  const [install] = applyAgent(zed, "install", true);
  expect(install).toMatchObject({ status: "skipped" });
  expect(install!.detail).toContain("context_servers");
  expect(applyAgent(zed, "remove", true)[0]!.text).toContain("by hand");
  expect(readFileSync(path, "utf8")).toBe(original);
});
