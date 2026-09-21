import { spawn, execFileSync, type ChildProcess } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { Page } from "@playwright/test";

const LOUPE_ROOT = process.cwd();
const URL_PATTERN = /http:\/\/localhost:\d+\/\?review=[\w-]+/;

// one file in the fixture repo: `base` is committed (omit for an added file), `work` is the
// working-tree content that produces the diff.
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

// a throwaway git repo whose working tree differs from HEAD, so a real diff is served.
export function makeFixture(files: FixtureFile[]): string {
  const dir = mkdtempSync(join(tmpdir(), "diffle-e2e-"));
  git(dir, "init", "-q");
  git(dir, "config", "user.email", "e2e@diffle.test");
  git(dir, "config", "user.name", "diffle e2e");
  const committed = files.filter((f) => f.base !== undefined);
  for (const f of committed) write(dir, f.path, f.base as string);
  write(dir, ".gitkeep", "");
  git(dir, "add", ".");
  git(dir, "commit", "-qm", "base");
  for (const f of files) write(dir, f.path, f.work);
  return dir;
}

// launch the real bun backend in the fixture and return the review url it prints.
export function startPreview(fixture: string): { server: ChildProcess; url: Promise<string> } {
  const server = spawn("bun", [join(LOUPE_ROOT, "src", "index.ts"), "--no-open"], {
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
    server.on("exit", (code) => reject(new Error(`server exited early (${code})`)));
  });
  return { server, url };
}

// stop the backend and wait for exit before the caller removes the fixture dir (windows locks).
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

// navigate to the app and dismiss the auto-shown "what's new" overlay if it appears, so it
// doesn't block the tracer's interactions. (dismissing it persists seenVersion server-side.)
export async function gotoApp(page: Page, url: string): Promise<void> {
  await page.goto(url);
  const whatsNew = page.getByRole("dialog", { name: /What's new/ });
  await whatsNew
    .waitFor({ state: "visible", timeout: 800 })
    .then(() => page.keyboard.press("Escape"))
    .catch(() => {});
}

export function cleanup(fixture: string): void {
  try {
    rmSync(fixture, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  } catch {
    // best-effort — the os reaps the temp dir regardless
  }
}
