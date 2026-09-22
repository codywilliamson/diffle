import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// shared scaffolding for the install.sh / install.ps1 suites: a fake release binary, its
// published checksum, temp dirs, and a spawn helper that captures both streams
export const root = join(import.meta.dir, "..", "..");
export const binary = "verified diffle binary\n";
export const checksum = createHash("sha256").update(binary).digest("hex");

const tempDirs: string[] = [];

export function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "diffle-installer-test-"));
  tempDirs.push(dir);
  return dir;
}

export function cleanupTempDirs(): void {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
}

export interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

export async function run(command: string, args: string[], cwd: string, env: Record<string, string> = {}): Promise<RunResult> {
  const proc = Bun.spawn([command, ...args], { cwd, stdout: "pipe", stderr: "pipe", env: { ...process.env, ...env } });
  const [code, stdout, stderr] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  return { code, stdout, stderr };
}
