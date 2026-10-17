import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { COMPLETION_SHELLS, type CompletionShell } from "../src/utils/cliVocabulary";
import { parseCliArgs } from "../src/utils/cli";
import { renderCompletion } from "../src/utils/completion";
import { completionModel } from "../src/utils/completion/model";

const dirs: string[] = [];
const temp = (name: string) => { const dir = mkdtempSync(join(tmpdir(), name)); dirs.push(dir); return dir; };
afterEach(() => { while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true }); });

const scripts = Object.fromEntries(COMPLETION_SHELLS.map((shell) => [shell, renderCompletion(shell)])) as Record<CompletionShell, string>;
const model = completionModel();

describe("completion scripts", () => {
  for (const shell of COMPLETION_SHELLS) {
    test(`${shell} output matches the snapshot`, () => {
      expect(scripts[shell]).toMatchSnapshot();
    });
  }

  test("every command, subcommand, flag and enumerable flag value appears in every shell", () => {
    for (const shell of COMPLETION_SHELLS) {
      for (const command of model) {
        if (command.name !== "review") expect(scripts[shell]).toContain(command.name);
        for (const sub of command.subcommands) expect(scripts[shell]).toContain(sub);
        for (const flag of command.flags) {
          for (const name of flag.names) {
            const spelled = shell === "fish" ? (name.startsWith("--") ? `-l ${name.slice(2)}` : `-s ${name.slice(1)}`) : name;
            expect(scripts[shell]).toContain(spelled);
          }
          for (const value of flag.values) expect(scripts[shell]).toContain(value);
        }
      }
    }
  });

  test("every flag the parser knows is in the model", () => {
    const parserSource = readFileSync(join(import.meta.dir, "..", "src", "utils", "cli.ts"), "utf8");
    const known = new Set([...parserSource.matchAll(/"(--?[a-z][a-z-]*)"/g)].map((match) => match[1]!));
    const modelled = new Set(model.flatMap((command) => command.flags.flatMap((flag) => flag.names)));
    expect(known.size).toBeGreaterThan(8);
    expect([...known].filter((flag) => !modelled.has(flag))).toEqual([]);
  });

  test("every modelled flag and subcommand is accepted by the parser", () => {
    for (const command of model) {
      const lead = command.name === "review" ? [] : [command.name];
      for (const flag of command.flags) {
        for (const name of flag.names) {
          try { parseCliArgs([...lead, name]); } catch (err) { expect(String(err)).not.toMatch(/unknown option|unexpected argument/); }
        }
      }
    }
    expect(model.find((command) => command.name === "mcp")!.subcommands).toEqual(["serve", "list", "restart"]);
  });

  test("flag values come from the parser's own tables", () => {
    const flag = (command: string, name: string) => model.find((entry) => entry.name === command)!.flags.find((entry) => entry.names.includes(name))!;
    expect(flag("hook", "--agent").values).toEqual(["codex", "claude-code"]);
    expect(flag("completion", "--shell").values).toEqual([...COMPLETION_SHELLS]);
    expect(flag("setup", "--agents").values).toContain("claude");
  });

  test("refs are listed lazily by git at completion time", () => {
    for (const shell of COMPLETION_SHELLS) expect(scripts[shell]).toMatch(/for-each-ref '?--format=%\(refname:short\)'? refs\/heads refs\/remotes refs\/tags/);
    const spawned: string[] = [];
    const realSync = Bun.spawnSync; const realSpawn = Bun.spawn;
    (Bun as any).spawnSync = (...args: unknown[]) => { spawned.push(String(args[0])); return realSync.apply(Bun, args as never); };
    (Bun as any).spawn = (...args: unknown[]) => { spawned.push(String(args[0])); return realSpawn.apply(Bun, args as never); };
    try { for (const shell of COMPLETION_SHELLS) renderCompletion(shell); } finally { (Bun as any).spawnSync = realSync; (Bun as any).spawn = realSpawn; }
    expect(spawned).toEqual([]);
  });
});

describe("completion parsing", () => {
  test("completion needs a known --shell", () => {
    expect(parseCliArgs(["completion", "--shell", "zsh"])).toMatchObject({ command: "completion", shell: "zsh" });
    expect(parseCliArgs(["completion"]).shell).toBeUndefined();
    expect(() => parseCliArgs(["completion", "--shell", "tcsh"])).toThrow("--shell must be one of: bash, zsh, fish, powershell");
    expect(() => parseCliArgs(["--shell", "bash"])).toThrow("unexpected argument: --shell");
  });
});

// the syntax checks and the live bash/powershell runs skip with a message when a shell is missing.
function writeScript(shell: CompletionShell, extension: string): string {
  const file = join(temp("nittle-completion-"), `nittle.${extension}`);
  writeFileSync(file, scripts[shell]);
  return file;
}
const run = (cmd: string[], cwd?: string, env: Record<string, string> = {}) =>
  Bun.spawnSync(cmd, { cwd, env: { ...process.env, ...env } as Record<string, string> });
// pwsh is a store alias bun cannot resolve on some windows installs, so fall back to windows powershell
const findPowerShell = () => Bun.which("pwsh") ?? Bun.which("powershell");
const SLOW_SHELL_MS = 60_000; // powershell cold start can take several seconds on a busy machine
const skip = (tool: string) => { console.log(`skipping ${tool} completion check: ${tool} is not installed`); };

describe("completion syntax checks", () => {
  test("bash -n", () => {
    const bash = Bun.which("bash");
    if (!bash) return skip("bash");
    const result = run([bash, "-n", writeScript("bash", "bash")]);
    expect(result.stderr.toString()).toBe("");
    expect(result.exitCode).toBe(0);
  });

  test("zsh -n", () => {
    const zsh = Bun.which("zsh");
    if (!zsh) return skip("zsh");
    const result = run([zsh, "-n", writeScript("zsh", "zsh")]);
    expect(result.stderr.toString()).toBe("");
    expect(result.exitCode).toBe(0);
  });

  test("fish --no-execute", () => {
    const fish = Bun.which("fish");
    if (!fish) return skip("fish");
    const result = run([fish, "--no-execute", writeScript("fish", "fish")]);
    expect(result.stderr.toString()).toBe("");
    expect(result.exitCode).toBe(0);
  });

  test("powershell parses without errors", () => {
    const pwsh = findPowerShell();
    if (!pwsh) return skip("powershell");
    const parse = "$e = $null; $t = $null; [void][System.Management.Automation.Language.Parser]::ParseInput((Get-Content -Raw $env:COMPLETION_FILE), [ref]$t, [ref]$e); $e | ForEach-Object { $_.Message }; exit $e.Count";
    const result = run([pwsh, "-NoProfile", "-Command", parse], undefined, { COMPLETION_FILE: writeScript("powershell", "ps1") });
    expect(result.stdout.toString()).toBe("");
    expect(result.exitCode).toBe(0);
  }, SLOW_SHELL_MS);
});

describe("completion in a live shell", () => {
  function repoWithBranches(): string {
    const repo = temp("nittle-completion-repo-");
    const git = (...args: string[]) => run(["git", ...args], repo);
    git("init", "-q", "-b", "main"); git("config", "user.name", "t"); git("config", "user.email", "t@e.com");
    writeFileSync(join(repo, "a.txt"), "x\n"); git("add", "-A"); git("commit", "-q", "-m", "init");
    git("branch", "feature/late-branch"); git("tag", "v9.9.9");
    return repo;
  }

  test("bash completes commands, subcommands, flag values and refs created after generation", () => {
    const bash = Bun.which("bash");
    if (!bash) return skip("bash");
    const repo = repoWithBranches();
    const script = writeScript("bash", "bash");
    const driver = [
      `source "$1"`,
      `try() { COMP_WORDS=("$@"); COMP_CWORD=$(( \${#COMP_WORDS[@]} - 1 )); _nittle; echo "\${COMPREPLY[*]}"; }`,
      `try nittle sh`, `try nittle mcp ""`, `try nittle hook stop --agent ""`, `try nittle show feat`, `try nittle "" `, `try nittle setup --y`,
    ].join("\n");
    const driverFile = join(temp("nittle-completion-driver-"), "driver.sh");
    writeFileSync(driverFile, driver);
    const lines = run([bash, driverFile, script], repo).stdout.toString().replace(/\r/g, "").trim().split("\n");
    expect(lines[0]).toBe("show");
    expect(lines[1]).toBe("serve list restart");
    expect(lines[2]).toBe("codex claude-code");
    expect(lines[3]).toBe("feature/late-branch");
    expect(lines[4]!.split(" ")).toEqual(expect.arrayContaining(["show", "mcp", "completion", "staged", "main", "feature/late-branch", "v9.9.9"]));
    expect(lines[5]).toBe("--yes");
  }, SLOW_SHELL_MS);

  test("powershell completes subcommands, flag values and refs", () => {
    const pwsh = findPowerShell();
    if (!pwsh) return skip("powershell");
    const repo = repoWithBranches();
    const script = writeScript("powershell", "ps1");
    const driver = [
      "Invoke-Expression (Get-Content -Raw $env:COMPLETION_FILE)",
      "function t($line) { (TabExpansion2 $line $line.Length).CompletionMatches | ForEach-Object { $_.CompletionText } }",
      "(t 'nittle mcp ') -join ' '", "(t 'nittle hook stop --agent ') -join ' '", "(t 'nittle show feat') -join ' '", "(t 'nittle setup --y') -join ' '",
    ].join("\n");
    const result = run([pwsh, "-NoProfile", "-Command", driver], repo, { COMPLETION_FILE: script });
    const lines = result.stdout.toString().replace(/\r/g, "").trim().split("\n");
    expect(lines).toEqual(["list restart serve", "claude-code codex", "feature/late-branch", "--yes"]);
  }, SLOW_SHELL_MS);
});
