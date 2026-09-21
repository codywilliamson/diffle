// launches the real diffle backend against a throwaway git fixture and hands back the review
// url it prints — the same approach as e2e/harness.ts, so captures are of the actual product,
// never hand-authored UI. node-only (playwright under bun on windows hangs).
import { spawn, execFileSync, type ChildProcess } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = join(HERE, "..", "..", "..");
const URL_PATTERN = /http:\/\/localhost:\d+\/\?review=[\w-]+/;

// one file in the fixture: omit `base` for an added file; `work` is the working-tree content.
export interface FixtureFile {
  path: string;
  base?: string;
  work: string;
}

function git(cwd: string, ...args: string[]): void {
  execFileSync("git", args, { cwd, stdio: "pipe" });
}

function write(dir: string, rel: string, content: string): void {
  const abs = join(dir, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content);
}

export function makeFixture(files: FixtureFile[]): string {
  // nest the repo under a fixed name so the top bar reads "api", not a random temp suffix.
  const parent = mkdtempSync(join(tmpdir(), "diffle-demo-"));
  const dir = join(parent, "api");
  mkdirSync(dir, { recursive: true });
  git(dir, "init", "-q");
  git(dir, "config", "user.email", "demo@diffle.dev");
  git(dir, "config", "user.name", "diffle demo");
  for (const f of files.filter((f) => f.base !== undefined)) write(dir, f.path, f.base as string);
  write(dir, ".gitkeep", "");
  git(dir, "add", ".");
  git(dir, "commit", "-qm", "base");
  for (const f of files) write(dir, f.path, f.work);
  return dir;
}

export function startBackend(fixture: string): { server: ChildProcess; url: Promise<string> } {
  const server = spawn("bun", [join(REPO_ROOT, "src", "index.ts"), "--no-open"], {
    cwd: fixture,
    env: { ...process.env, LOUPE_SESSION_HOST: "cli" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const url = new Promise<string>((resolve, reject) => {
    let out = "";
    const timer = setTimeout(() => reject(new Error(`no url printed:\n${out}`)), 15_000);
    server.stdout?.on("data", (chunk) => {
      out += String(chunk);
      const match = out.match(URL_PATTERN);
      if (match) {
        clearTimeout(timer);
        resolve(match[0]);
      }
    });
    server.on("exit", (code) => reject(new Error(`backend exited early (${code})`)));
  });
  return { server, url };
}

export function stop(server: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    const done = setTimeout(resolve, 4_000);
    server.once("exit", () => {
      clearTimeout(done);
      resolve();
    });
    server.kill();
  });
}

export function cleanup(fixture: string): void {
  try {
    rmSync(dirname(fixture), { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  } catch {
    // best-effort — the os reaps the temp dir regardless
  }
}
