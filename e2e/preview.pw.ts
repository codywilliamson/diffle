import { test, expect } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const LOUPE_ROOT = process.cwd();
const URL_PATTERN = /http:\/\/localhost:\d+\/\?review=[\w-]+/;

function git(cwd: string, ...args: string[]): void {
  execFileSync("git", args, { cwd, stdio: "pipe" });
}

// a throwaway git repo with one committed file and a working-tree edit — a real 1-file diff.
function makeFixture(): string {
  const dir = mkdtempSync(join(tmpdir(), "diffle-e2e-"));
  git(dir, "init", "-q");
  git(dir, "config", "user.email", "e2e@diffle.test");
  git(dir, "config", "user.name", "diffle e2e");
  writeFileSync(join(dir, "greeting.ts"), "export const hello = 'hi';\n");
  git(dir, "add", ".");
  git(dir, "commit", "-qm", "base");
  writeFileSync(join(dir, "greeting.ts"), "export const hello = 'hello there';\n");
  return dir;
}

// launch the real bun backend in the fixture and return the review url it prints.
function startPreview(fixture: string) {
  const server = spawn("bun", [join(LOUPE_ROOT, "src", "index.ts"), "--no-open"], {
    cwd: fixture,
    env: { ...process.env, LOUPE_SESSION_HOST: "cli" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const url = new Promise<string>((resolve, reject) => {
    let out = "";
    const timer = setTimeout(() => reject(new Error(`no url printed:\n${out}`)), 15_000);
    server.stdout.on("data", (chunk) => {
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

// stop the backend and wait for it to actually exit before touching the fixture dir,
// so windows does not fail to remove a directory the process still holds.
function stop(server: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    const done = setTimeout(resolve, 4_000);
    server.once("exit", () => {
      clearTimeout(done);
      resolve();
    });
    server.kill();
  });
}

test("production preview serves the svelte client with a real diff", async ({ page }) => {
  const fixture = makeFixture();
  const { server, url } = startPreview(fixture);
  try {
    await page.goto(await url);
    await expect(page.getByRole("heading", { name: "diffle" })).toBeVisible();
    await expect(page.getByText(/1 file\b/)).toBeVisible();
  } finally {
    await stop(server);
    try {
      rmSync(fixture, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    } catch {
      // best-effort — the os reaps the temp dir regardless
    }
  }
});
