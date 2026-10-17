import { spawn, execFileSync, type ChildProcess } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import type { Page } from "@playwright/test";
import { PRODUCT } from "../src/core/product";

const REPO_ROOT = process.cwd();
const URL_PATTERN = /http:\/\/localhost:\d+\/\?review=[\w-]+/;
const FIXTURE_PARENT_PREFIX = "nittle-e2e-";
const WHATS_NEW_SOURCE = join(REPO_ROOT, "client", "src", "lib", "whatsNew.ts");

export interface FixtureOptions {
  // fixed folder name for the repo dir (shown in the UI as the repo name); default is the random temp name.
  leaf?: string;
}

export interface PreviewOptions {
  // write the current what's-new version into the isolated home's state.json so the modal never opens.
  seenWhatsNew?: boolean;
}

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
export function makeFixture(files: FixtureFile[], options: FixtureOptions = {}): string {
  const parent = mkdtempSync(join(tmpdir(), FIXTURE_PARENT_PREFIX));
  const dir = options.leaf ? join(parent, options.leaf) : parent;
  mkdirSync(dir, { recursive: true });
  git(dir, "init", "-q", "-b", "main");
  git(dir, "config", "user.email", "e2e@nittle.test");
  git(dir, "config", "user.name", "nittle e2e");
  const committed = files.filter((f) => f.base !== undefined);
  for (const f of committed) write(dir, f.path, f.base as string);
  write(dir, ".gitkeep", "");
  git(dir, "add", ".");
  git(dir, "commit", "-qm", "base");
  for (const f of files) write(dir, f.path, f.work);
  return dir;
}

// review records + state live beside the fixture (inside it they'd show up in the diff), never
// in the real ~/.nittle.
export const dataDirFor = (fixture: string): string => `${fixture}-data`;

// every server runs with a throwaway home, so it can never read or write the real ~/.nittle,
// ~/.claude, ~/.codex or other agent configs.
const homeFor = (fixture: string): string => `${fixture}-home`;

function seedState(home: string): void {
  const version = /version:\s*"([^"]+)"/.exec(readFileSync(WHATS_NEW_SOURCE, "utf8"))?.[1];
  if (!version) throw new Error(`no what's-new version found in ${WHATS_NEW_SOURCE}`);
  write(home, join(PRODUCT.dataDir, "state.json"), `${JSON.stringify({ seenVersion: version })}\n`);
}

function isolatedEnv(fixture: string): NodeJS.ProcessEnv {
  const home = homeFor(fixture);
  mkdirSync(home, { recursive: true });
  return {
    ...process.env,
    HOME: home,
    USERPROFILE: home,
    APPDATA: join(home, "AppData", "Roaming"),
    LOCALAPPDATA: join(home, "AppData", "Local"),
    XDG_CONFIG_HOME: join(home, ".config"),
    CLAUDE_CONFIG_DIR: join(home, ".claude"),
    CODEX_HOME: join(home, ".codex"),
    NITTLE_SESSION_HOST: "cli",
    NITTLE_DATA_DIR: dataDirFor(fixture),
    NITTLE_NO_UPDATE_CHECK: "1",
  };
}

// launch the real bun backend in the fixture and return the review url it prints.
export function startPreview(fixture: string, options: PreviewOptions = {}): { server: ChildProcess; url: Promise<string> } {
  if (options.seenWhatsNew) seedState(homeFor(fixture));
  const server = spawn("bun", [join(REPO_ROOT, "src", "index.ts"), "--no-open"], {
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
  const parent = dirname(fixture);
  const dirs = [fixture, dataDirFor(fixture), homeFor(fixture)];
  if (basename(parent).startsWith(FIXTURE_PARENT_PREFIX)) dirs.push(parent);
  for (const dir of dirs) {
    try {
      rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    } catch {
      // best-effort — the os reaps the temp dir regardless
    }
  }
}
