import { afterEach, describe, expect, it, spyOn } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { delimiter, join } from "node:path";
import { cleanupTempDirs, fakeClaude, healthyConfigDir, staleConfigDir, tempDir, writeFile } from "./helpers/claudeConfig";
import { runDoctorCommand } from "../src/utils/doctorCli";

const root = join(import.meta.dir, "..");
const entry = join(root, "src", "index.ts");

afterEach(cleanupTempDirs);

interface DoctorRun { code: number; out: string; }

// runs the real cli so exit codes and the spawned `claude` calls are exercised end to end.
// the release check is opted out so these never reach GitHub.
// the automatic first-run swap is skipped unless a test passes `extraEnv` without the skip flag
const SKIP_MIGRATION = { NITTLE_SKIP_AGENT_MIGRATION: "1" };

async function doctor(configDir: string, args: string[], binDir: string, extraEnv: Record<string, string> = SKIP_MIGRATION): Promise<DoctorRun> {
  const proc = Bun.spawn({
    cmd: [process.execPath, entry, "doctor", ...args],
    env: { ...process.env, CLAUDE_CONFIG_DIR: configDir, PATH: binDir, Path: binDir, NITTLE_NO_UPDATE_CHECK: "1", ...extraEnv },
    stdout: "pipe", stderr: "pipe",
  });
  const [out, err] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text()]);
  return { code: await proc.exited, out: out + err };
}

const logLines = (log: string) => (existsSync(log) ? readFileSync(log, "utf8").trim().split(/\r?\n/).filter(Boolean) : []);

describe("nittle doctor", () => {
  it("reports the stale install, prints the repair commands, and exits 1", async () => {
    const { code, out } = await doctor(staleConfigDir(), [], tempDir());
    expect(code).toBe(1);
    expect(out).toContain("FAIL");
    expect(out).toContain("diffle-review@diffle-local v0.1.1");
    expect(out).toContain("diffle-review-hook@diffle-local");
    expect(out).toContain("diffle-local still registered");
    expect(out).toContain("diffle (diffle-review@diffle-local) runs `diffle`");
    expect(out).toContain("To repair, run:");
    for (const command of [
      "claude plugin uninstall diffle-review@diffle-local",
      "claude plugin uninstall diffle-review-hook@diffle-local",
      "claude plugin marketplace remove diffle-local",
      "claude plugin marketplace add codywilliamson/diffle",
      "claude plugin install nittle-review@nittle-local --scope user",
    ]) expect(out).toContain(command);
  });

  it("exits 0 with nothing to repair on a healthy install", async () => {
    const { code, out } = await doctor(healthyConfigDir(), [], tempDir());
    expect(code).toBe(0);
    expect(out).toContain("nothing to repair");
    expect(out).not.toContain("FAIL");
    expect(out).toMatch(/INFO\s+release\s+check disabled \(NITTLE_NO_UPDATE_CHECK\)/);
  });

  it("--fix without claude on PATH prints the commands and runs nothing", async () => {
    const { code, out } = await doctor(staleConfigDir(), ["--fix", "--yes"], tempDir());
    expect(code).toBe(1);
    expect(out).toContain("is not on PATH");
    expect(out).toContain("claude plugin uninstall diffle-review@diffle-local");
  });

  it("--fix --yes drives every step through claude and passes --yes to install", async () => {
    const { binDir, log } = fakeClaude(0);
    const { code, out } = await doctor(staleConfigDir(), ["--fix", "--yes"], binDir);
    expect(code).toBe(0);
    const calls = logLines(log);
    expect(calls).toHaveLength(5);
    expect(calls[0]).toContain("plugin uninstall diffle-review@diffle-local");
    expect(calls[4]).toContain("plugin install nittle-review@nittle-local --scope user --yes");
    expect(out).toContain("/reload-plugins");
  });

  it("stops on the first failing step", async () => {
    const { binDir, log } = fakeClaude(1);
    const { code, out } = await doctor(staleConfigDir(), ["--fix", "--yes"], binDir);
    expect(code).toBe(1);
    expect(logLines(log)).toHaveLength(1);
    expect(out).toContain("step failed");
  });
});

describe("nittle doctor with the automatic swap", () => {
  it("swaps the retired claude plugins on startup, before doctor reports", async () => {
    const { binDir, log } = fakeClaude(0);
    const { out } = await doctor(staleConfigDir(), [], binDir, {});
    expect(out).toContain("[nittle] Claude Code: removed");
    const calls = logLines(log);
    expect(calls[0]).toContain("plugin uninstall diffle-review@diffle-local");
    expect(calls.at(-1)).toContain("plugin install nittle-review@nittle-local --scope user --yes");
  });

  it("reports and repairs an mcp config the automatic pass skipped", async () => {
    const home = tempDir();
    const cursor = join(home, ".cursor", "mcp.json");
    writeFile(cursor, { mcpServers: { diffle: { command: "diffle", args: ["mcp", "serve"] }, other: { command: "o" } } });
    const env = { ...SKIP_MIGRATION, HOME: home, USERPROFILE: home };
    const report = await doctor(healthyConfigDir(), [], tempDir(), env);
    expect(report.code).toBe(1);
    expect(report.out).toMatch(/FAIL\s+Cursor\s+.*still launches a retired server/);
    expect(report.out).toContain("rewrite");

    const fixed = await doctor(healthyConfigDir(), ["--fix", "--yes"], tempDir(), env);
    expect(fixed.code).toBe(0);
    expect(JSON.parse(readFileSync(cursor, "utf8")).mcpServers).toEqual({ nittle: { command: "nittle", args: ["mcp", "serve"] }, other: { command: "o" } });
    expect((await doctor(healthyConfigDir(), [], tempDir(), env)).code).toBe(0);
  });

  it("flags a config it can't edit as a failure with no automatic repair", async () => {
    const home = tempDir();
    writeFile(join(home, ".cursor", "mcp.json"), `{ // c
 "mcpServers": { "diffle": { "command": "diffle" } } }`);
    const { code, out } = await doctor(healthyConfigDir(), [], tempDir(), { ...SKIP_MIGRATION, HOME: home, USERPROFILE: home });
    expect(code).toBe(1);
    expect(out).toContain("can't be edited automatically");
  });
});

// in-process with an injected release feed: the release row without touching the network.
describe("nittle doctor release row", () => {
  async function releaseRow(fetchTags: () => Promise<string[]>): Promise<string> {
    const saved = { config: process.env.CLAUDE_CONFIG_DIR, optOut: process.env.NITTLE_NO_UPDATE_CHECK };
    process.env.CLAUDE_CONFIG_DIR = healthyConfigDir();
    delete process.env.NITTLE_NO_UPDATE_CHECK;
    const log = spyOn(console, "log").mockImplementation(() => {});
    try {
      await runDoctorCommand({ fix: false, yes: false }, root, fetchTags);
      return log.mock.calls.map((call) => String(call[0])).find((line) => /\srelease\s/.test(line)) ?? "";
    } finally {
      log.mockRestore();
      if (saved.config === undefined) delete process.env.CLAUDE_CONFIG_DIR; else process.env.CLAUDE_CONFIG_DIR = saved.config;
      if (saved.optOut !== undefined) process.env.NITTLE_NO_UPDATE_CHECK = saved.optOut;
    }
  }

  it("warns when a newer release is published", async () => {
    expect(await releaseRow(async () => ["v999.0.0"])).toMatch(/WARN\s+release\s+v999\.0\.0 available — /);
  });

  it("is OK on the latest release", async () => {
    const version = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;
    const row = await releaseRow(async () => [`v${version}`]);
    expect(row).toMatch(/OK\s+release\s/);
    expect(row).toContain(`v${version} is the latest`);
  });

  it("reports an unreachable channel as info", async () => {
    expect(await releaseRow(async () => [])).toMatch(/INFO\s+release\s+could not reach GitHub/);
  });
});
