import { afterEach, describe, expect, it, spyOn } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { delimiter, join } from "node:path";
import { cleanupTempDirs, fakeClaude, healthyConfigDir, staleConfigDir, tempDir } from "./helpers/claudeConfig";
import { runDoctorCommand } from "../src/utils/doctorCli";

const root = join(import.meta.dir, "..");
const entry = join(root, "src", "index.ts");

afterEach(cleanupTempDirs);

interface DoctorRun { code: number; out: string; }

// runs the real cli so exit codes and the spawned `claude` calls are exercised end to end.
// the release check is opted out so these never reach GitHub.
async function doctor(configDir: string, args: string[], binDir: string): Promise<DoctorRun> {
  const proc = Bun.spawn({
    cmd: [process.execPath, entry, "doctor", ...args],
    env: { ...process.env, CLAUDE_CONFIG_DIR: configDir, PATH: binDir, Path: binDir, DIFFLE_NO_UPDATE_CHECK: "1" },
    stdout: "pipe", stderr: "pipe",
  });
  const [out, err] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text()]);
  return { code: await proc.exited, out: out + err };
}

const logLines = (log: string) => (existsSync(log) ? readFileSync(log, "utf8").trim().split(/\r?\n/).filter(Boolean) : []);

describe("diffle doctor", () => {
  it("reports the stale install, prints the repair commands, and exits 1", async () => {
    const { code, out } = await doctor(staleConfigDir(), [], tempDir());
    expect(code).toBe(1);
    expect(out).toContain("FAIL");
    expect(out).toContain("loupe-review@loupe-local v0.1.1");
    expect(out).toContain("loupe-review-hook@loupe-local");
    expect(out).toContain("loupe-local still registered");
    expect(out).toContain("loupe (loupe-review@loupe-local) runs `loupe`");
    expect(out).toContain("To repair, run:");
    for (const command of [
      "claude plugin uninstall loupe-review@loupe-local",
      "claude plugin uninstall loupe-review-hook@loupe-local",
      "claude plugin marketplace remove loupe-local",
      "claude plugin marketplace add codywilliamson/diffle",
      "claude plugin install diffle-review@diffle-local --scope user",
    ]) expect(out).toContain(command);
  });

  it("exits 0 with nothing to repair on a healthy install", async () => {
    const { code, out } = await doctor(healthyConfigDir(), [], tempDir());
    expect(code).toBe(0);
    expect(out).toContain("nothing to repair");
    expect(out).not.toContain("FAIL");
    expect(out).toMatch(/INFO\s+release\s+check disabled \(DIFFLE_NO_UPDATE_CHECK\)/);
  });

  it("--fix without claude on PATH prints the commands and runs nothing", async () => {
    const { code, out } = await doctor(staleConfigDir(), ["--fix", "--yes"], tempDir());
    expect(code).toBe(1);
    expect(out).toContain("is not on PATH");
    expect(out).toContain("claude plugin uninstall loupe-review@loupe-local");
  });

  it("--fix --yes drives every step through claude and passes --yes to install", async () => {
    const { binDir, log } = fakeClaude(0);
    const { code, out } = await doctor(staleConfigDir(), ["--fix", "--yes"], binDir);
    expect(code).toBe(0);
    const calls = logLines(log);
    expect(calls).toHaveLength(5);
    expect(calls[0]).toContain("plugin uninstall loupe-review@loupe-local");
    expect(calls[4]).toContain("plugin install diffle-review@diffle-local --scope user --yes");
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

// in-process with an injected release feed: the release row without touching the network.
describe("diffle doctor release row", () => {
  async function releaseRow(fetchTags: () => Promise<string[]>): Promise<string> {
    const saved = { config: process.env.CLAUDE_CONFIG_DIR, optOut: process.env.DIFFLE_NO_UPDATE_CHECK };
    process.env.CLAUDE_CONFIG_DIR = healthyConfigDir();
    delete process.env.DIFFLE_NO_UPDATE_CHECK;
    const log = spyOn(console, "log").mockImplementation(() => {});
    try {
      await runDoctorCommand({ fix: false, yes: false }, root, fetchTags);
      return log.mock.calls.map((call) => String(call[0])).find((line) => /\srelease\s/.test(line)) ?? "";
    } finally {
      log.mockRestore();
      if (saved.config === undefined) delete process.env.CLAUDE_CONFIG_DIR; else process.env.CLAUDE_CONFIG_DIR = saved.config;
      if (saved.optOut !== undefined) process.env.DIFFLE_NO_UPDATE_CHECK = saved.optOut;
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
