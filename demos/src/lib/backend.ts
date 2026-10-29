// launches the real nittle backend against a throwaway git fixture and hands back the review
// url it prints — the same approach as e2e/harness.ts, so captures are of the actual product,
// never hand-authored UI. node-only (playwright under bun on windows hangs).
import { spawn, execFileSync, type ChildProcess } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = join(HERE, "..", "..", "..");
// demos ships typescript-language-server as a devDependency so code-nav takes work on any machine.
const DEMO_BIN = join(HERE, "..", "..", "node_modules", ".bin");
const WHATS_NEW_SOURCE = join(REPO_ROOT, "client", "src", "lib", "whatsNew.ts");
const URL_PATTERN = /http:\/\/(?:localhost|127\.0\.0\.1):\d+\/\?review=[\w-]+/;

// one file in the fixture: omit `base` for an added file; `work` is the working-tree content.
export interface FixtureFile {
  path: string;
  base?: string;
  work: string;
}

export interface FixtureOptions {
  churn?: { path: string; commits: number }; // recent commits touching a file, for hotspot flags
  commit?: { message: string; author: string }; // commit the working tree too (for `nittle show`)
}

function git(cwd: string, ...args: string[]): void {
  execFileSync("git", args, { cwd, stdio: "pipe" });
}

function write(dir: string, rel: string, content: string): void {
  const abs = join(dir, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content);
}

function commitChurn(dir: string, churn: NonNullable<FixtureOptions["churn"]>): void {
  for (let i = 1; i <= churn.commits; i++) {
    write(dir, churn.path, `// revision ${i}\n`);
    git(dir, "add", ".");
    git(dir, "commit", "-qm", `chore: tweak ${churn.path} (${i})`);
  }
}

export function makeFixture(files: FixtureFile[], options: FixtureOptions = {}): string {
  // nest the repo under a fixed name so the top bar reads "api", not a random temp suffix.
  const parent = mkdtempSync(join(tmpdir(), "nittle-demo-"));
  const dir = join(parent, "api");
  mkdirSync(dir, { recursive: true });
  git(dir, "init", "-q");
  git(dir, "config", "user.email", "demo@nittle.dev");
  git(dir, "config", "user.name", "nittle demo");
  git(dir, "config", "core.autocrlf", "false");
  if (options.churn) commitChurn(dir, options.churn);
  for (const f of files.filter((f) => f.base !== undefined)) write(dir, f.path, f.base as string);
  write(dir, ".gitkeep", "");
  git(dir, "add", ".");
  git(dir, "commit", "-qm", "base");
  for (const f of files) write(dir, f.path, f.work);
  if (options.commit) {
    git(dir, "add", ".");
    git(dir, "commit", "-q", "--author", options.commit.author, "-m", options.commit.message);
  }
  return dir;
}

// rewrite one working-tree file mid-take (the agent's next round).
export function editFixture(fixture: string, path: string, content: string): void {
  write(fixture, path, content);
}

// windows spells it Path; drop every casing so the child sees exactly one PATH.
function withoutPath(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return Object.fromEntries(Object.entries(env).filter(([key]) => key.toUpperCase() !== "PATH"));
}

// a throwaway home with the what's-new modal already seen, so no dialog covers the first frame
// and nothing reads or writes the real ~/.nittle.
function isolatedEnv(fixture: string): NodeJS.ProcessEnv {
  const home = join(dirname(fixture), "home");
  const version = /version:\s*"([^"]+)"/.exec(readFileSync(WHATS_NEW_SOURCE, "utf8"))?.[1];
  if (version) write(home, join(".nittle", "state.json"), `${JSON.stringify({ seenVersion: version })}\n`);
  return {
    ...withoutPath(process.env),
    PATH: `${DEMO_BIN}${delimiter}${process.env.PATH ?? ""}`,
    HOME: home,
    USERPROFILE: home,
    NITTLE_DATA_DIR: join(dirname(fixture), "data"),
    NITTLE_NO_UPDATE_CHECK: "1",
    NITTLE_SESSION_HOST: "cli",
  };
}

export function startBackend(fixture: string, args: string[] = []): { server: ChildProcess; url: Promise<string> } {
  const server = spawn("bun", [join(REPO_ROOT, "src", "index.ts"), ...args, "--no-open"], {
    cwd: fixture,
    env: isolatedEnv(fixture),
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
    server.stderr?.on("data", (chunk) => (out += String(chunk)));
    server.on("exit", (code) => reject(new Error(`backend exited early (${code}):\n${out}`)));
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
