import { afterEach, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type AgentEnv, agentTargets, isDetected, MCP_SERVER_NAME, serverCommand } from "../src/core/agentTargets";
import { PRODUCT, repositorySlug } from "../src/core/product";
import { cleanupTempDirs, tempDir } from "./helpers/claudeConfig";

afterEach(cleanupTempDirs);

const linux = (home: string, env: AgentEnv["env"] = {}): AgentEnv => ({ home, platform: "linux", env });
const byId = (env: AgentEnv, id: string) => agentTargets(env).find((t) => t.id === id)!;
const mcpPath = (env: AgentEnv, id: string) => {
  const { integration } = byId(env, id);
  if (integration.kind !== "mcp-config") throw new Error("not mcp-config");
  return integration.path;
};

test("registry ids in order", () => {
  expect(agentTargets(linux("/h")).map((t) => t.id)).toEqual(
    ["claude", "codex", "cursor", "gemini", "vscode", "windsurf", "opencode", "zed", "copilot"],
  );
  expect(MCP_SERVER_NAME).toBe(PRODUCT.name);
});

test("plugin argv comes from PRODUCT", () => {
  const ref = `${PRODUCT.plugin.name}@${PRODUCT.plugin.marketplace}`;
  const claude = byId(linux("/h"), "claude");
  const codex = byId(linux("/h"), "codex");
  expect(claude.integration).toEqual({
    kind: "plugin", cli: "claude",
    install: [["plugin", "marketplace", "add", repositorySlug()], ["plugin", "install", ref, "--scope", "user"]],
    remove: [["plugin", "uninstall", ref, "--scope", "user"]],
  });
  expect(codex.integration).toEqual({
    kind: "plugin", cli: "codex",
    install: [["plugin", "marketplace", "add", repositorySlug()], ["plugin", "add", ref]],
    remove: [["plugin", "remove", ref]],
  });
  expect(claude.configDir).toBe(join("/h", ".claude"));
  expect(codex.binary).toBe("codex");
});

test("home-relative config paths and entries", () => {
  const env = linux("/h");
  expect(mcpPath(env, "cursor")).toBe(join("/h", ".cursor", "mcp.json"));
  expect(mcpPath(env, "gemini")).toBe(join("/h", ".gemini", "settings.json"));
  expect(mcpPath(env, "windsurf")).toBe(join("/h", ".codeium", "windsurf", "mcp_config.json"));
  expect(mcpPath(env, "copilot")).toBe(join("/h", ".copilot", "mcp-config.json"));
  expect(byId(env, "copilot").integration).toMatchObject({
    key: "mcpServers", entry: { type: "local", command: PRODUCT.name, args: ["mcp", "serve"], tools: ["*"] },
  });
});

test("vscode and zed paths per platform", () => {
  const win: AgentEnv = { home: "C:\\u", platform: "win32", env: { APPDATA: "C:\\roam" } };
  const mac: AgentEnv = { home: "/Users/u", platform: "darwin", env: {} };
  expect(mcpPath(win, "vscode")).toBe(join("C:\\roam", "Code", "User", "mcp.json"));
  expect(mcpPath(win, "zed")).toBe(join("C:\\roam", "Zed", "settings.json"));
  expect(mcpPath(mac, "vscode")).toBe(join("/Users/u", "Library", "Application Support", "Code", "User", "mcp.json"));
  expect(mcpPath(mac, "zed")).toBe(join("/Users/u", ".config", "zed", "settings.json"));
  expect(mcpPath(linux("/h"), "vscode")).toBe(join("/h", ".config", "Code", "User", "mcp.json"));
  expect(byId(linux("/h"), "vscode").integration).toMatchObject({
    key: "servers", entry: { type: "stdio", command: PRODUCT.name, args: ["mcp", "serve"] },
  });
});

test("XDG_CONFIG_HOME overrides ~/.config", () => {
  const env = linux("/h", { XDG_CONFIG_HOME: "/xdg" });
  expect(mcpPath(env, "zed")).toBe(join("/xdg", "zed", "settings.json"));
  expect(mcpPath(env, "vscode")).toBe(join("/xdg", "Code", "User", "mcp.json"));
  expect(mcpPath(env, "opencode")).toBe(join("/xdg", "opencode", "opencode.json"));
  expect(byId(env, "opencode").configDir).toBe(join("/xdg", "opencode"));
});

test("opencode prefers an existing opencode.jsonc", () => {
  const xdg = tempDir();
  mkdirSync(join(xdg, "opencode"));
  const env = linux("/h", { XDG_CONFIG_HOME: xdg });
  expect(mcpPath(env, "opencode")).toBe(join(xdg, "opencode", "opencode.json"));
  writeFileSync(join(xdg, "opencode", "opencode.jsonc"), "{}");
  expect(mcpPath(env, "opencode")).toBe(join(xdg, "opencode", "opencode.jsonc"));
  expect(byId(env, "opencode").integration).toMatchObject({
    key: "mcp", entry: { type: "local", command: [PRODUCT.name, "mcp", "serve"], enabled: true },
  });
});

test("isDetected uses binary or config dir", () => {
  const target = byId(linux("/h"), "cursor");
  const none = () => null;
  expect(isDetected(target, none, () => false)).toBe(false);
  expect(isDetected(target, (bin) => (bin === "cursor" ? "/bin/cursor" : null), () => false)).toBe(true);
  expect(isDetected(target, none, (p) => p === target.configDir)).toBe(true);
});

test("serverCommand pins the installed binary and falls back to the bare name", () => {
  expect(serverCommand("/home/u/.diffle/bin/diffle")).toBe("/home/u/.diffle/bin/diffle");
  expect(serverCommand("C:/Users/u/.diffle/bin/Diffle.exe")).toBe("C:/Users/u/.diffle/bin/Diffle.exe");
  expect(serverCommand("/usr/local/bin/bun")).toBe(PRODUCT.name);
  expect(serverCommand("/home/u/.loupe/bin/loupe")).toBe(PRODUCT.name);
});

test("mcp entries launch the injected command", () => {
  const env = { ...linux("/h"), command: "/opt/diffle/bin/diffle" };
  const entryOf = (id: string) => {
    const { integration } = byId(env, id);
    if (integration.kind !== "mcp-config") throw new Error("not mcp-config");
    return integration.entry;
  };
  expect(entryOf("cursor")).toEqual({ command: "/opt/diffle/bin/diffle", args: ["mcp", "serve"] });
  expect(entryOf("opencode").command).toEqual(["/opt/diffle/bin/diffle", "mcp", "serve"]);
});
