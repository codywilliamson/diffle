// drives each generated completion script inside the real shell and checks what tab would offer.
// every shell is skipped with a message when it is not installed (ci installs zsh and fish on ubuntu).

import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CompletionShell } from "../src/utils/cliVocabulary";
import { renderCompletion } from "../src/utils/completion";

const SPAWN_TIMEOUT_MS = 40_000; // powershell cold start is the slow one
const TEST_TIMEOUT_MS = 50_000; // always above the spawn timeout so a hang fails on the spawn, not the runner

interface LiveCase { words: string[]; offers: string[]; why: string }

const CASES: LiveCase[] = [
  { words: ["nittle", "sh"], offers: ["show"], why: "command prefix" },
  { words: ["nittle", "mcp", ""], offers: ["list", "restart", "serve"], why: "subcommands" },
  { words: ["nittle", "hook", "stop", "--agent", ""], offers: ["claude-code", "codex"], why: "flag values" },
  { words: ["nittle", "setup", "--y"], offers: ["--yes"], why: "flag prefix" },
  { words: ["nittle", "show", "feat"], offers: ["feature/late-branch"], why: "ref made after generation" },
  { words: ["nittle", "-p", "80", "sh"], offers: ["show"], why: "a flag value is not a positional (review)" },
  { words: ["nittle", "show", "--port", "80", "feat"], offers: ["feature/late-branch"], why: "a flag value is not a positional (show)" },
  { words: ["nittle", "mcp", "--yes", ""], offers: ["list", "restart", "serve"], why: "a boolean flag is not a value" },
];

const dirs: string[] = [];
afterAll(() => { for (const dir of dirs) rmSync(dir, { recursive: true, force: true }); });
const temp = (name: string) => { const dir = mkdtempSync(join(tmpdir(), name)); dirs.push(dir); return dir; };

const run = (cmd: string[], cwd: string, env: Record<string, string> = {}) =>
  Bun.spawnSync(cmd, { cwd, timeout: SPAWN_TIMEOUT_MS, env: { ...process.env, ...env } as Record<string, string> });
const skip = (tool: string) => { console.log(`skipping live ${tool} completion check: ${tool} is not installed`); };
// pwsh is a store alias bun cannot resolve on some windows installs, so fall back to windows powershell
const findPowerShell = () => Bun.which("pwsh") ?? Bun.which("powershell");

function repoWithBranches(): string {
  const repo = temp("nittle-live-repo-");
  const git = (...args: string[]) => run(["git", ...args], repo);
  git("init", "-q", "-b", "main"); git("config", "user.name", "t"); git("config", "user.email", "t@e.com");
  writeFileSync(join(repo, "a.txt"), "x\n"); git("add", "-A"); git("commit", "-q", "-m", "init");
  git("branch", "feature/late-branch"); git("tag", "v9.9.9");
  return repo;
}

function write(shell: CompletionShell, file: string, text: string): string {
  const path = join(temp(`nittle-live-${shell}-`), file);
  writeFileSync(path, text);
  return path;
}

const shQuote = (text: string) => `'${text.replace(/'/g, "'\\''")}'`;
const lines = (stdout: Uint8Array | Buffer) => stdout.toString().replace(/\r/g, "").trimEnd().split("\n");
const normalize = (line: string) => line.split(/\s+/).filter(Boolean).sort();

function check(output: string[]) {
  expect(output.length).toBe(CASES.length);
  CASES.forEach((entry, index) => expect({ why: entry.why, got: normalize(output[index]!) }).toEqual({ why: entry.why, got: entry.offers }));
}

describe("live completion", () => {
  test("bash", () => {
    const bash = Bun.which("bash");
    if (!bash) return skip("bash");
    const driver = [
      `source "$1"`,
      `try() { COMP_WORDS=("$@"); COMP_CWORD=$(( \${#COMP_WORDS[@]} - 1 )); _nittle; echo "\${COMPREPLY[*]}"; }`,
      ...CASES.map((entry) => `try ${entry.words.map(shQuote).join(" ")}`),
    ].join("\n");
    check(lines(run([bash, write("bash", "driver.sh", driver), write("bash", "nittle.bash", renderCompletion("bash"))], repoWithBranches()).stdout));
  }, TEST_TIMEOUT_MS);

  test("zsh", () => {
    const zsh = Bun.which("zsh");
    if (!zsh) return skip("zsh");
    // stand-ins for the completion builtins: print what would be offered, filtered by the typed prefix
    const driver = [
      `source "$1"`,
      `compadd() { local a; if [[ $1 == -a ]]; then for a in "\${(@P)2}"; do [[ $a == \${~PREFIX}* ]] && print -r -- $a; done; return 0; fi; [[ $1 == -- ]] && shift; for a in "$@"; do [[ $a == \${~PREFIX}* ]] && print -r -- $a; done; return 0 }`,
      `_describe() { local arr=\${@[-1]} e; for e in "\${(@P)arr}"; do e=\${e%%:*}; [[ $e == \${~PREFIX}* ]] && print -r -- $e; done; return 0 }`,
      `try() { words=("$@"); CURRENT=$#; PREFIX=\${@[-1]}; print -r -- "$(_nittle | sort | tr '\\n' ' ')" }`,
      ...CASES.map((entry) => `try ${entry.words.map(shQuote).join(" ")}`),
    ].join("\n");
    check(lines(run([zsh, "-f", write("zsh", "driver.zsh", driver), write("zsh", "nittle.zsh", renderCompletion("zsh"))], repoWithBranches()).stdout));
  }, TEST_TIMEOUT_MS);

  test("fish", () => {
    const fish = Bun.which("fish");
    if (!fish) return skip("fish");
    const driver = [
      `source $argv[1]`,
      ...CASES.map((entry) => `echo (complete -C ${shQuote(entry.words.join(" "))} | string replace -r '\\t.*' '' | sort | string join ' ')`),
    ].join("\n");
    check(lines(run([fish, "--no-config", write("fish", "driver.fish", driver), write("fish", "nittle.fish", renderCompletion("fish"))], repoWithBranches()).stdout));
  }, TEST_TIMEOUT_MS);

  test("powershell", () => {
    const pwsh = findPowerShell();
    if (!pwsh) return skip("powershell");
    const driver = [
      "Invoke-Expression (Get-Content -Raw $env:COMPLETION_FILE)",
      "function t($line) { (TabExpansion2 $line $line.Length).CompletionMatches | ForEach-Object { $_.CompletionText } }",
      ...CASES.map((entry) => `(t '${entry.words.join(" ").replace(/'/g, "''")}') -join ' '`),
    ].join("\n");
    const script = write("powershell", "nittle.ps1", renderCompletion("powershell"));
    check(lines(run([pwsh, "-NoProfile", "-Command", driver], repoWithBranches(), { COMPLETION_FILE: script }).stdout));
  }, TEST_TIMEOUT_MS);
});
