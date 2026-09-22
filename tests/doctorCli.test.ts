import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { delimiter, join } from "node:path";
import { cleanupTempDirs, fakeClaude, healthyConfigDir, staleConfigDir, tempDir } from "./helpers/claudeConfig";

const entry = join(import.meta.dir, "..", "src", "index.ts");

afterEach(cleanupTempDirs);

interface DoctorRun { code: number; out: string; }

// runs the real cli so exit codes and the spawned `claude` calls are exercised end to end.
async function doctor(configDir: string, args: string[], binDir: string): Promise<DoctorRun> {
  const proc = Bun.spawn({
    cmd: [process.execPath, entry, "doctor", ...args],
    env: { ...process.env, CLAUDE_CONFIG_DIR: configDir, PATH: binDir, Path: binDir },
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
