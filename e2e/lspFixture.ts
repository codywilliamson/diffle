// the typescript fixture repo for the navigation spec: tests/fixtures/lsp-ts copied to a temp
// git repo whose working tree changes two files, so the diff has greeter.ts and main.ts while
// text.ts (and the dependency under node_modules) stay unchanged.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { delimiter, join } from "node:path";
import { prepareLspFixture } from "../tests/helpers/lspFixture";

const SERVER = "typescript-language-server";

// the language server on PATH, or undefined. node-side twin of src/core/lsp/which.ts, which needs bun.
export function findLanguageServer(): string | undefined {
  const extensions = process.platform === "win32" ? [".cmd", ".exe", ".bat", ""] : [""];
  for (const dir of (process.env.PATH ?? "").split(delimiter)) {
    for (const extension of extensions) {
      const candidate = join(dir, SERVER + extension);
      try {
        if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
      } catch {
        // unreadable path entry
      }
    }
  }
  return undefined;
}

function git(cwd: string, ...args: string[]): void {
  execFileSync("git", args, { cwd, stdio: "pipe" });
}

function edit(root: string, path: string, from: string, to: string): void {
  const file = join(root, path);
  const text = readFileSync(file, "utf8");
  if (!text.includes(from)) throw new Error(`${from} not in ${path}`);
  writeFileSync(file, text.replace(from, to));
}

export function makeLspFixture(server: string): string {
  const root = prepareLspFixture(server);
  writeFileSync(join(root, ".gitignore"), "node_modules\n");
  git(root, "init", "-q", "-b", "main");
  git(root, "config", "user.email", "e2e@nittle.test");
  git(root, "config", "user.name", "nittle e2e");
  git(root, "add", ".");
  git(root, "commit", "-qm", "base");
  edit(root, "src/greeter.ts", "return `${this.greeting}, ${name}`;", "return `${this.greeting}, ${name}!`;");
  edit(root, "src/main.ts", 'new Greeter("hello")', 'new Greeter("hello there")');
  return root;
}
