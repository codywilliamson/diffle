import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { migrateAgentPlugins } from "../src/core/migration/agentPlugins";
import { stopLegacyMcpServers } from "../src/core/mcpProcesses";
import { cleanupTempDirs, staleConfigDir, tempDir, writeFile } from "./helpers/claudeConfig";

afterEach(cleanupTempDirs);

const NITTLE = "/opt/nittle/bin/nittle";
const serve = ["mcp", "serve"];
const read = (path: string) => readFileSync(path, "utf8");
const readJson = (path: string) => JSON.parse(read(path)) as Record<string, any>;

interface Run { lines: string[]; calls: string[]; stopped: number; home: string; claudeDir: string; }

function migrate(home: string, claudeDir = join(home, ".claude"), run = (_cli: string, _args: string[]) => 0): Run {
  const calls: string[] = [];
  let stopped = 0;
  const lines = migrateAgentPlugins({
    agentEnv: { home, platform: "linux", env: { CLAUDE_CONFIG_DIR: claudeDir }, command: NITTLE },
    run: (cli, args) => { calls.push(`${cli} ${args.join(" ")}`); return run(cli, args); },
    which: (bin) => `/usr/bin/${bin}`, log: () => {}, stopServers: () => { stopped++; },
  });
  return { lines, calls, stopped, home, claudeDir };
}

function seedMcpConfigs(home: string): void {
  writeFile(join(home, ".cursor", "mcp.json"), {
    mcpServers: { other: { command: "other-mcp", args: ["x"] }, "diffle-review": { command: "/h/.diffle/bin/diffle", args: serve }, loupe: { command: "loupe", args: serve } },
  });
  writeFile(join(home, ".gemini", "settings.json"), { theme: "dark", mcpServers: { diffle: { command: "diffle-mcp" } } });
  writeFile(join(home, ".config", "Code", "User", "mcp.json"), { servers: { diffle: { type: "stdio", command: "diffle", args: serve } } });
  writeFile(join(home, ".config", "opencode", "opencode.json"), { mcp: { diffle: { type: "local", command: ["diffle", ...serve], enabled: true } } });
  writeFile(join(home, ".config", "zed", "settings.json"), { context_servers: { custom: { source: "custom", command: "keep" }, diffle: { source: "custom", command: "diffle", args: serve } } });
}

describe("agent plugin migration", () => {
  it("is a no-op without touching anything when no legacy plugin or config exists", () => {
    const home = tempDir();
    writeFile(join(home, ".cursor", "mcp.json"), { mcpServers: { other: { command: "o" } } });
    const result = migrate(home);
    expect(result.lines).toEqual([]);
    expect(result.calls).toEqual([]);
    expect(result.stopped).toBe(0);
  });

  it("rewrites every json mcp config to nittle and leaves unrelated entries alone", () => {
    const home = tempDir();
    seedMcpConfigs(home);
    const result = migrate(home);
    expect(result.stopped).toBe(1);

    expect(readJson(join(home, ".cursor", "mcp.json")).mcpServers).toEqual({
      other: { command: "other-mcp", args: ["x"] }, nittle: { command: NITTLE, args: serve },
    });
    expect(readJson(join(home, ".gemini", "settings.json"))).toEqual({ theme: "dark", mcpServers: { nittle: { command: NITTLE, args: serve } } });
    expect(readJson(join(home, ".config", "Code", "User", "mcp.json")).servers).toEqual({ nittle: { type: "stdio", command: NITTLE, args: serve } });
    expect(readJson(join(home, ".config", "opencode", "opencode.json")).mcp).toEqual({ nittle: { type: "local", command: [NITTLE, ...serve], enabled: true } });
    expect(readJson(join(home, ".config", "zed", "settings.json")).context_servers).toEqual({
      custom: { source: "custom", command: "keep" }, nittle: { source: "custom", command: NITTLE, args: serve },
    });
    expect(result.lines.some((line) => line.startsWith("[nittle] Cursor:"))).toBe(true);
    expect(result.lines).toHaveLength(5);
    for (const file of [join(home, ".cursor", "mcp.json"), join(home, ".gemini", "settings.json")]) expect(read(file)).not.toMatch(/diffle|loupe/);
  });

  it("a second run finds nothing left to do", () => {
    const home = tempDir();
    seedMcpConfigs(home);
    migrate(home);
    expect(migrate(home).lines).toEqual([]);
  });

  it("keeps an existing nittle entry and drops the retired duplicate", () => {
    const home = tempDir();
    writeFile(join(home, ".cursor", "mcp.json"), { mcpServers: { nittle: { command: "mine", args: serve }, diffle: { command: "diffle", args: serve } } });
    migrate(home);
    expect(readJson(join(home, ".cursor", "mcp.json")).mcpServers).toEqual({ nittle: { command: "mine", args: serve } });
  });

  it("reports a config it can't edit instead of rewriting it", () => {
    const home = tempDir();
    const path = join(home, ".cursor", "mcp.json");
    const jsonc = `{\n  // mine\n  "mcpServers": { "diffle": { "command": "diffle" } }\n}\n`;
    writeFile(path, jsonc);
    const result = migrate(home);
    expect(read(path)).toBe(jsonc);
    expect(result.lines[0]).toContain("can't be edited automatically");
    expect(result.lines[0]).toContain("nittle doctor --fix");
  });

  it("rewrites codex's toml mcp table and swaps the retired codex plugins, byte-for-byte elsewhere", () => {
    const home = tempDir();
    const config = join(home, ".codex", "config.toml");
    const before = [
      "model = \"gpt\"", "",
      "[mcp_servers.other]", "command = \"other\"", "",
      "[mcp_servers.diffle]", "command = \"C:\\\\Users\\\\u\\\\.diffle\\\\bin\\\\diffle.exe\" # launcher", "args = [\"mcp\", \"serve\"]", "",
      "[mcp_servers.diffle.env]", "FOO = \"1\"", "",
      "[plugins.\"diffle-review@diffle-local\"]", "enabled = true", "",
      "[plugins.\"loupe-review@loupe-local\"]", "enabled = true", "",
      "[marketplaces.diffle-local]", "source = \"https://github.com/codywilliamson/diffle\"", "",
    ].join("\n");
    mkdirSync(join(home, ".codex"), { recursive: true });
    writeFileSync(config, before);
    const result = migrate(home);
    const after = read(config);
    expect(after).toContain(`[mcp_servers.nittle]\ncommand = "${NITTLE}" # launcher\nargs = ["mcp", "serve"]`);
    expect(after).toContain("[mcp_servers.nittle.env]\nFOO = \"1\"");
    expect(after).toContain("model = \"gpt\"\n\n[mcp_servers.other]\ncommand = \"other\"\n");
    expect(after).not.toContain("mcp_servers.diffle");
    expect(result.calls).toEqual([
      "codex plugin remove diffle-review@diffle-local",
      "codex plugin remove loupe-review@loupe-local",
      "codex plugin marketplace remove diffle-local",
      "codex plugin marketplace add codywilliamson/diffle",
      "codex plugin add nittle-review@nittle-local",
    ]);
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0]).toContain("Codex");
  });

  it("removes diffle-review and loupe-review from claude code and installs nittle-review", () => {
    const home = tempDir();
    const claudeDir = staleConfigDir();
    const registry = join(claudeDir, "plugins", "installed_plugins.json");
    const plugins = readJson(registry);
    plugins.plugins["loupe-review@loupe-local"] = [{ version: "0.1.0", scope: "user", installPath: join(claudeDir, "cache", "loupe") }];
    writeFile(registry, plugins);
    const result = migrate(home, claudeDir);
    expect(result.calls).toContain("claude plugin uninstall diffle-review@diffle-local");
    expect(result.calls).toContain("claude plugin uninstall loupe-review@loupe-local");
    expect(result.calls.at(-1)).toBe("claude plugin install nittle-review@nittle-local --scope user --yes");
    expect(result.calls.every((call) => !call.includes("install nittle") || call.includes("--yes"))).toBe(true);
    expect(result.lines).toEqual([expect.stringContaining("Claude Code: removed")]);
  });

  it("leaves a failing claude swap for doctor and says so", () => {
    const result = migrate(tempDir(), staleConfigDir(), () => 1);
    expect(result.calls).toHaveLength(1);
    expect(result.lines[0]).toContain("left:");
    expect(result.lines[0]).toContain("nittle doctor --fix");
  });

  it("leaves a plugin swap for doctor when the agent cli is missing", () => {
    const lines = migrateAgentPlugins({
      agentEnv: { home: tempDir(), platform: "linux", env: { CLAUDE_CONFIG_DIR: staleConfigDir() }, command: NITTLE },
      run: () => 0, which: () => null, log: () => {}, stopServers: () => {},
    });
    expect(lines[0]).toContain("`claude` is not on PATH");
  });
});

describe("stopLegacyMcpServers", () => {
  it("stops only retired-binary servers", () => {
    const stopped: number[] = [];
    const result = stopLegacyMcpServers(
      () => [{ pid: 1, path: "/h/.diffle/bin/diffle" }, { pid: 2, path: "C:\\Users\\u\\.nittle\\bin\\nittle.exe" }, { pid: 3, path: "C:\\x\\Diffle.exe" }],
      (pid) => { stopped.push(pid); return pid !== 3; },
    );
    expect(stopped).toEqual([1, 3]);
    expect(result).toEqual({ found: 2, stopped: 1, failed: 1 });
  });

  it("never throws when the process table can't be read", () => {
    expect(stopLegacyMcpServers(() => { throw new Error("no ps"); })).toEqual({ found: 0, stopped: 0, failed: 0 });
  });
});
