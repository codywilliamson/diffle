import { afterEach, describe, expect, it } from "bun:test";
import { join } from "node:path";
import { cleanupTempDirs, healthyConfigDir, staleConfigDir, tempDir, writeFile } from "./helpers/claudeConfig";
import { diagnoseClaudePlugins, hasStaleLegacyPlugin, readClaudePluginState } from "../src/utils/claudePlugins";

afterEach(() => { delete process.env.CLAUDE_CONFIG_DIR; cleanupTempDirs(); });

const commands = (dir: string, productPath?: string) =>
  diagnoseClaudePlugins(readClaudePluginState(dir), productPath).plan.map((step) => step.args.join(" "));

const levels = (dir: string, productPath?: string) =>
  diagnoseClaudePlugins(readClaudePluginState(dir), productPath).checks.map((check) => check.level);

describe("readClaudePluginState", () => {
  it("reads both legacy plugins, the marketplace, the enabled flag, and the wired MCP server", () => {
    const state = readClaudePluginState(staleConfigDir());
    expect(state.legacy.map((p) => p.key)).toEqual(["loupe-review@loupe-local", "loupe-review-hook@loupe-local"]);
    expect(state.legacy[0]!.version).toBe("0.1.1");
    expect(state.legacyEnabled).toEqual(["loupe-review@loupe-local"]);
    expect(state.legacyMarketplaces).toEqual(["loupe-local"]);
    expect(state.legacyMcpServers).toEqual([{ plugin: "loupe-review@loupe-local", server: "loupe" }]);
    expect(state.product).toEqual([]);
    expect(state.unreadable).toEqual([]);
  });

  it("honours CLAUDE_CONFIG_DIR when no dir is passed", () => {
    process.env.CLAUDE_CONFIG_DIR = staleConfigDir();
    expect(readClaudePluginState().legacy).toHaveLength(2);
  });

  it("tolerates a missing config dir, missing files, and malformed json", () => {
    const missing = join(tempDir(), "nope");
    const state = readClaudePluginState(missing);
    expect(state.legacy).toEqual([]);
    expect(state.unreadable).toHaveLength(3);
    expect(state.unreadable.every((path) => path.startsWith(missing))).toBe(true);

    const broken = tempDir();
    writeFile(join(broken, "plugins", "installed_plugins.json"), "{ not json");
    writeFile(join(broken, "settings.json"), "[]");
    const brokenState = readClaudePluginState(broken);
    expect(brokenState.legacy).toEqual([]);
    expect(brokenState.unreadable.some((path) => path.endsWith("installed_plugins.json"))).toBe(true);
    expect(brokenState.unreadable.some((path) => path.endsWith("settings.json"))).toBe(true);
  });

  it("accepts a bare object where an array of installs is expected", () => {
    const dir = tempDir();
    writeFile(join(dir, "plugins", "installed_plugins.json"), {
      plugins: { "loupe-review@loupe-local": { version: "0.1.1", installPath: "" }, "broken@loupe-local": null },
    });
    const state = readClaudePluginState(dir);
    expect(state.legacy).toEqual([{ key: "loupe-review@loupe-local", name: "loupe-review", marketplace: "loupe-local", version: "0.1.1", installPath: "" }]);
  });
});

describe("hasStaleLegacyPlugin", () => {
  it("is true only while nothing has replaced the legacy plugin", () => {
    expect(hasStaleLegacyPlugin(readClaudePluginState(staleConfigDir()))).toBe(true);
    expect(hasStaleLegacyPlugin(readClaudePluginState(staleConfigDir({ withProduct: true })))).toBe(false);
    expect(hasStaleLegacyPlugin(readClaudePluginState(healthyConfigDir()))).toBe(false);
  });
});

describe("diagnoseClaudePlugins", () => {
  it("fails a stale-only install and plans the full repair", () => {
    const dir = staleConfigDir();
    const { checks, ok } = diagnoseClaudePlugins(readClaudePluginState(dir), "/bin/diffle");
    expect(ok).toBe(false);
    expect(levels(dir, "/bin/diffle")).toContain("fail");
    expect(checks.find((c) => c.label === "legacy plugins")!.detail).toContain("loupe-review@loupe-local v0.1.1");
    expect(checks.find((c) => c.label === "legacy MCP server")!.level).toBe("fail");
    expect(commands(dir, "/bin/diffle")).toEqual([
      "plugin uninstall loupe-review@loupe-local",
      "plugin uninstall loupe-review-hook@loupe-local",
      "plugin marketplace remove loupe-local",
      "plugin marketplace add codywilliamson/diffle",
      "plugin install diffle-review@diffle-local --scope user",
    ]);
  });

  it("only warns, and plans cleanup alone, once diffle-review is installed too", () => {
    const dir = staleConfigDir({ withProduct: true });
    const { ok, checks } = diagnoseClaudePlugins(readClaudePluginState(dir), "/bin/diffle");
    expect(ok).toBe(true);
    expect(checks.some((c) => c.level === "warn")).toBe(true);
    expect(commands(dir, "/bin/diffle")).toEqual([
      "plugin uninstall loupe-review@loupe-local",
      "plugin uninstall loupe-review-hook@loupe-local",
      "plugin marketplace remove loupe-local",
    ]);
  });

  it("reports a healthy install with an empty plan", () => {
    const dir = healthyConfigDir();
    expect(levels(dir, "/bin/diffle")).toEqual(["ok", "ok", "ok", "ok", "ok", "ok"]);
    expect(commands(dir, "/bin/diffle")).toEqual([]);
  });

  it("carries a custom marketplace suffix into the plan", () => {
    const dir = staleConfigDir({ marketplace: "my-loupe", hook: false });
    expect(commands(dir, "/bin/diffle").slice(0, 2)).toEqual([
      "plugin uninstall loupe-review@my-loupe",
      "plugin marketplace remove my-loupe",
    ]);
  });

  it("warns when diffle is missing from PATH and notes a resolvable loupe", () => {
    const dir = healthyConfigDir();
    const { checks, ok } = diagnoseClaudePlugins(readClaudePluginState(dir), undefined, "/bin/loupe", true);
    expect(ok).toBe(true);
    expect(checks.find((c) => c.label.includes("`diffle` on PATH"))!.level).toBe("warn");
    expect(checks.find((c) => c.label.includes("`loupe` on PATH"))!.detail).toBe("/bin/loupe");
    expect(checks.find((c) => c.label === "data dir")!.detail).toContain(".loupe");
  });

  it("surfaces unreadable files as info lines rather than throwing", () => {
    const missing = join(tempDir(), "nope");
    const { checks, ok } = diagnoseClaudePlugins(readClaudePluginState(missing), "/bin/diffle");
    expect(ok).toBe(true);
    expect(checks.filter((c) => c.detail.startsWith("could not read"))).toHaveLength(3);
  });
});
