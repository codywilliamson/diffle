// drives each generated completion script inside the real shell and checks what tab would offer.
// every shell is skipped with a message when it is not installed (ci installs zsh and fish on ubuntu).

import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CompletionShell } from "../src/utils/cliVocabulary";
import { renderCompletion } from "../src/utils/completion";
import { findBash } from "./helpers/findBash";
import { runUntilIdle } from "./helpers/runUntilIdle";

const SPAWN_TIMEOUT_MS = 40_000; // powershell cold start is the slow one
const TEST_TIMEOUT_MS = 50_000; // always above the spawn timeout so a hang fails on the spawn, not the runner
const POWERSHELL_IDLE_MS = 40_000; // longest powershell may go without printing a result line
const POWERSHELL_TEST_TIMEOUT_MS = 240_000; // generous cap: the idle window is what catches a hang

interface LiveCase { words: string[]; offers: string[]; powershell?: string[]; why: string }

// refs whose names a shell could mistake for code: they must come back as exact literals, and never run
const EVIL_REFS = ["feature/$(touch${IFS}PWNED)", "feature/o'quote", "feature/a;Get-Date"];
const SAFE_REF = "feature/late-branch";
// powershell inserts anything that is not plainly safe as a single-quoted literal
const psInsert = (ref: string) => (/^[A-Za-z0-9_./+-]+$/.test(ref) ? ref : `'${ref.replace(/'/g, "''")}'`);

const CASES: LiveCase[] = [
  { words: ["nittle", "sh"], offers: ["show"], why: "command prefix" },
  { words: ["nittle", "mcp", ""], offers: ["list", "restart", "serve"], why: "subcommands" },
  { words: ["nittle", "hook", "stop", "--agent", ""], offers: ["claude-code", "codex"], why: "flag values" },
  { words: ["nittle", "setup", "--y"], offers: ["--yes"], why: "flag prefix" },
  { words: ["nittle", "show", "feature/l"], offers: [SAFE_REF], why: "ref made after generation" },
  { words: ["nittle", "show", "feature/"], offers: [SAFE_REF, ...EVIL_REFS], powershell: [SAFE_REF, ...EVIL_REFS.map(psInsert)], why: "refs that look like code are literals" },
  { words: ["nittle", "-p", "80", "feature/l"], offers: [SAFE_REF], why: "a flag value is not a positional (review ref)" },
  { words: ["nittle", "-p", "80", "sh"], offers: [], why: "commands only at argv[0], like the parser" },
  { words: ["nittle", "show", "--port", "80", "feature/l"], offers: [SAFE_REF], why: "a flag value is not a positional (show)" },
  { words: ["nittle", "mcp", "serve", "--y"], offers: [], why: "mcp serve rejects --yes" },
  { words: ["nittle", "mcp", "restart", "--y"], offers: ["--yes"], why: "mcp restart accepts --yes" },
  { words: ["nittle", "mcp", "--h"], offers: ["--help"], why: "mcp before a subcommand takes only help" },
  { words: ["nittle", "show", "--vers"], offers: ["--version"], why: "show accepts --version" },
  { words: ["nittle", "show", "--licen"], offers: ["--license"], why: "show accepts --license" },
  { words: ["nittle", "show", "--wa"], offers: [], why: "show rejects --wait" },
  { words: ["nittle", "hook", "stop", "--ag"], offers: ["--agent"], why: "hook stop accepts --agent" },
  { words: ["nittle", "sessions", "--vers"], offers: ["--version"], why: "--version is accepted after any command" },
  { words: ["nittle", "mcp", "serve", "--licen"], offers: ["--license"], why: "--license is accepted after any subcommand" },
  // powershell replaces only the last list item, so it offers the id without the typed prefix
  { words: ["nittle", "setup", "--agents", "claude,co"], offers: ["claude,codex", "claude,copilot"], powershell: ["codex", "copilot"], why: "a comma-separated list completes after the last comma" },
  { words: ["nittle", "setup", "--agents", "c"], offers: ["claude", "codex", "copilot", "cursor"], why: "the first list item completes too" },
];

const dirs: string[] = [];
afterAll(() => { for (const dir of dirs) rmSync(dir, { recursive: true, force: true }); });
const temp = (name: string) => { const dir = mkdtempSync(join(tmpdir(), name)); dirs.push(dir); return dir; };

const run = (cmd: string[], cwd: string, env: Record<string, string> = {}) =>
  Bun.spawnSync(cmd, { cwd, timeout: SPAWN_TIMEOUT_MS, env: { ...process.env, ...env } as Record<string, string> });
const skip = (tool: string) => { console.log(`skipping live ${tool} completion check: ${tool} is not installed`); };
// pwsh is a store alias bun cannot resolve on some windows installs, so fall back to windows powershell
const findPowerShell = () => Bun.which("pwsh") ?? Bun.which("powershell");
async function runPowerShell(pwsh: string, driver: string, repo: string, completionFile: string): Promise<string[]> {
  const env = { ...process.env, COMPLETION_FILE: completionFile } as Record<string, string>;
  const result = await runUntilIdle([pwsh, "-NoProfile", "-Command", driver], { cwd: repo, env, idleMs: POWERSHELL_IDLE_MS });
  if (result.timedOut) throw new Error(`powershell printed nothing for ${POWERSHELL_IDLE_MS}ms`);
  return lines(result.stdout);
}

function repoWithBranches(): string {
  const repo = temp("nittle-live-repo-");
  const git = (...args: string[]) => run(["git", ...args], repo);
  git("init", "-q", "-b", "main"); git("config", "user.name", "t"); git("config", "user.email", "t@e.com");
  writeFileSync(join(repo, "a.txt"), "x\n"); git("add", "-A"); git("commit", "-q", "-m", "init");
  git("branch", SAFE_REF); git("tag", "v9.9.9");
  for (const ref of EVIL_REFS) git("branch", ref);
  return repo;
}

function write(shell: CompletionShell, file: string, text: string): string {
  const path = join(temp(`nittle-live-${shell}-`), file);
  writeFileSync(path, text);
  return path;
}

const shQuote = (text: string) => `'${text.replace(/'/g, "'\\''")}'`;
const lines = (stdout: string | Uint8Array | Buffer) => stdout.toString().replace(/\r/g, "").trimEnd().split("\n");
const normalize = (line: string) => line.split(/\s+/).filter(Boolean).sort();

function check(output: string[], repo: string, shell: CompletionShell) {
  expect(output.length).toBe(CASES.length);
  CASES.forEach((entry, index) => {
    const want = [...(shell === "powershell" ? entry.powershell ?? entry.offers : entry.offers)].sort();
    expect({ why: entry.why, got: normalize(output[index]!) }).toEqual({ why: entry.why, got: want });
  });
  expect(existsSync(join(repo, "PWNED"))).toBe(false);
}

describe("live completion", () => {
  test("bash", () => {
    const bash = findBash();
    if (!bash) return skip("bash");
    const driver = [
      `source "$1"`,
      `try() { COMP_WORDS=("$@"); COMP_CWORD=$(( \${#COMP_WORDS[@]} - 1 )); _nittle; echo "\${COMPREPLY[*]}"; }`,
      ...CASES.map((entry) => `try ${entry.words.map(shQuote).join(" ")}`),
    ].join("\n");
    const repo = repoWithBranches();
    check(lines(run([bash, write("bash", "driver.sh", driver), write("bash", "nittle.bash", renderCompletion("bash"))], repo).stdout), repo, "bash");
  }, TEST_TIMEOUT_MS);

  test("zsh", () => {
    const zsh = Bun.which("zsh");
    if (!zsh) return skip("zsh");
    // stand-ins for the completion builtins: print what would be offered, filtered by the typed prefix
    const driver = [
      `source "$1"`,
      `compadd() { local a; if [[ $1 == -a ]]; then for a in "\${(@P)2}"; do [[ $a == \${~PREFIX}* ]] && print -r -- "$IPREFIX$a"; done; return 0; fi; [[ $1 == -- ]] && shift; for a in "$@"; do [[ $a == \${~PREFIX}* ]] && print -r -- "$IPREFIX$a"; done; return 0 }`,
      // compset -P '*,' moves everything through the last comma from PREFIX into IPREFIX
      `compset() { [[ $1 == -P && $2 == '*,' && $PREFIX == *,* ]] || return 1; IPREFIX=\${PREFIX%"\${PREFIX##*,}"}; PREFIX=\${PREFIX##*,}; return 0 }`,
      `_describe() { local arr=\${@[-1]} e; for e in "\${(@P)arr}"; do e=\${e%%:*}; [[ $e == \${~PREFIX}* ]] && print -r -- $e; done; return 0 }`,
      `try() { words=("$@"); CURRENT=$#; IPREFIX=""; PREFIX=\${@[-1]}; print -r -- "$(_nittle | sort | tr '\\n' ' ')" }`,
      ...CASES.map((entry) => `try ${entry.words.map(shQuote).join(" ")}`),
    ].join("\n");
    const repo = repoWithBranches();
    check(lines(run([zsh, "-f", write("zsh", "driver.zsh", driver), write("zsh", "nittle.zsh", renderCompletion("zsh"))], repo).stdout), repo, "zsh");
  }, TEST_TIMEOUT_MS);

  test("fish", () => {
    const fish = Bun.which("fish");
    if (!fish) return skip("fish");
    const driver = [
      `source $argv[1]`,
      ...CASES.map((entry) => `echo (complete -C ${shQuote(entry.words.join(" "))} | string replace -r '\\t.*' '' | sort | string join ' ')`),
    ].join("\n");
    const repo = repoWithBranches();
    check(lines(run([fish, "--no-config", write("fish", "driver.fish", driver), write("fish", "nittle.fish", renderCompletion("fish"))], repo).stdout), repo, "fish");
  }, TEST_TIMEOUT_MS);

  test("zsh registers with compinit both autoloaded from $fpath and sourced", () => {
    const zsh = Bun.which("zsh");
    if (!zsh) return skip("zsh");
    const repo = repoWithBranches();
    const fpathDir = temp("nittle-live-fpath-");
    writeFileSync(join(fpathDir, "_nittle"), renderCompletion("zsh"));
    const sourced = write("zsh", "nittle.zsh", renderCompletion("zsh"));
    const shims = [
      `compadd() { local a; if [[ $1 == -a ]]; then for a in "\${(@P)2}"; do print -r -- $a; done; return 0; fi; [[ $1 == -- ]] && shift; for a in "$@"; do print -r -- $a; done; return 0 }`,
      `_describe() { return 0 }`,
    ];
    const compinit = (dump: string) => [`autoload -Uz compinit`, `compinit -u -d ${shQuote(dump)}`];
    const autoloadDriver = [
      `fpath=(${shQuote(fpathDir)} $fpath)`, ...compinit(join(temp("nittle-live-dump-"), "dump")), ...shims,
      `print -r -- "registered: $_comps[nittle]"`,
      `words=(nittle mcp ""); CURRENT=3; PREFIX=""; print -r -- "offers: $(_nittle | sort | tr '\\n' ' ')"`,
    ].join("\n");
    const sourcedDriver = [
      ...compinit(join(temp("nittle-live-dump-"), "dump")), `source ${shQuote(sourced)}`, `print -r -- "registered: $_comps[nittle]"`,
    ].join("\n");
    const out = (driver: string) => lines(run([zsh, "-f", write("zsh", "driver.zsh", driver)], repo).stdout).map((line) => line.trim());
    expect(out(autoloadDriver)).toEqual(["registered: _nittle", "offers: list restart serve"]);
    expect(out(sourcedDriver)).toEqual(["registered: _nittle"]);
  }, TEST_TIMEOUT_MS);

  test("powershell", async () => {
    const pwsh = findPowerShell();
    if (!pwsh) return skip("powershell");
    const driver = [
      "Invoke-Expression (Get-Content -Raw $env:COMPLETION_FILE)",
      "function t($line) { (TabExpansion2 $line $line.Length).CompletionMatches | ForEach-Object { $_.CompletionText } }",
      ...CASES.map((entry) => `(t '${entry.words.join(" ").replace(/'/g, "''")}') -join ' '`),
    ].join("\n");
    const script = write("powershell", "nittle.ps1", renderCompletion("powershell"));
    const repo = repoWithBranches();
    check(await runPowerShell(pwsh, driver, repo, script), repo, "powershell");
  }, POWERSHELL_TEST_TIMEOUT_MS);

  test("powershell completes with the cursor in the middle of the line", async () => {
    const pwsh = findPowerShell();
    if (!pwsh) return skip("powershell");
    // [text before the cursor][text after it]: words after the cursor must not count
    const MID_LINE: [string, string, string[]][] = [
      ["nittle sh", " --no-open", ["show"]],
      ["nittle mcp ", " serve", ["list", "restart", "serve"]],
      ["nittle show --no", " main", ["--no-lsp", "--no-open"]],
      ["nittle setup --agents claude,co", " --yes", ["codex", "copilot"]],
      ["nittle sh", "ow", ["show"]],
    ];
    const driver = [
      "Invoke-Expression (Get-Content -Raw $env:COMPLETION_FILE)",
      "function t($before, $after) { (TabExpansion2 ($before + $after) $before.Length).CompletionMatches | ForEach-Object { $_.CompletionText } }",
      ...MID_LINE.map(([before, after]) => `(t '${before}' '${after}') -join ' '`),
    ].join("\n");
    const out = await runPowerShell(pwsh, driver, repoWithBranches(), write("powershell", "nittle.ps1", renderCompletion("powershell")));
    expect(out.map(normalize)).toEqual(MID_LINE.map(([, , offers]) => [...offers].sort()));
  }, POWERSHELL_TEST_TIMEOUT_MS);
});
