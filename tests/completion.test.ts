import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { agentTargets } from "../src/core/agentTargets";
import { FLAG_SPECS, findFlag, type FlagSpec } from "../src/utils/cliFlags";
import { AGENT_IDS, COMPLETION_SHELLS, type CompletionShell } from "../src/utils/cliVocabulary";
import { parseCliArgs } from "../src/utils/cli";
import { renderCompletion } from "../src/utils/completion";
import { completionModel } from "../src/utils/completion/model";
import { findBash } from "./helpers/findBash";
import { describeEntry } from "../src/utils/completion/zsh";

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
        for (const flag of command.scopes.flatMap((scope) => scope.flags)) {
          for (const name of flag.names) {
            const spelled = shell === "fish" ? (name.startsWith("--") ? `-l ${name.slice(2)}` : `-s ${name.slice(1)}`) : name;
            expect(scripts[shell]).toContain(spelled);
          }
          for (const value of flag.values) expect(scripts[shell]).toContain(value);
        }
      }
    }
  });

  test("every flag spelling in the parser source is in the flag table", () => {
    const parserSource = readFileSync(join(import.meta.dir, "..", "src", "utils", "cli.ts"), "utf8");
    const literals = [...parserSource.matchAll(/"(--?[a-z][a-z-]*)"/g)].map((match) => match[1]!);
    expect(literals.length).toBeGreaterThan(8);
    expect(literals.filter((flag) => !findFlag(flag))).toEqual([]);
  });

  test("agent ids in the flag table are the ids setup targets", () => {
    expect(agentTargets().map((target) => target.id)).toEqual([...AGENT_IDS]);
  });

  test("completion offers a flag in a scope exactly when the parser accepts it", () => {
    const valueFor = (spec: FlagSpec) => (spec.valueName ? [spec.values?.[0] ?? (spec.names.includes("--port") ? "80" : "x")] : []);
    const checked: string[] = [];
    for (const command of model) {
      for (const scope of command.scopes) {
        const words = scope.key === "review" ? [] : scope.key.split(" ");
        const offered = new Set(scope.flags.flatMap((flag) => flag.names));
        for (const spec of FLAG_SPECS) {
          for (const name of spec.names) {
            let accepted = true;
            try { parseCliArgs([...words, name, ...valueFor(spec)]); } catch (err) { accepted = !/unknown option|unexpected argument|requires/.test(String(err)); }
            checked.push(`${scope.key} ${name}`);
            expect({ scope: scope.key, flag: name, accepted }).toEqual({ scope: scope.key, flag: name, accepted: offered.has(name) });
          }
        }
      }
    }
    expect(checked).toContain("mcp serve --help");
    expect(checked.length).toBeGreaterThan(150);
  });

  test("flag applicability the lead called out", () => {
    const offered = (key: string) => new Set(model.flatMap((command) => command.scopes).find((scope) => scope.key === key)!.flags.flatMap((flag) => flag.names));
    expect(offered("mcp serve").has("--yes")).toBe(false);
    expect(offered("mcp restart").has("--yes")).toBe(true);
    expect([...offered("mcp")]).toEqual(["-h", "--help"]);
    for (const key of ["review", "show", "sessions", "completion", "mcp serve", "mcp restart", "hook stop"]) {
      for (const flag of ["--version", "-v", "--license"]) expect({ key, flag, offered: offered(key).has(flag) }).toEqual({ key, flag, offered: true });
    }
    expect(offered("mcp").has("--version")).toBe(false);
    expect(parseCliArgs(["sessions", "--version"]).version).toBe(true);
    expect(parseCliArgs(["mcp", "serve", "--license"]).license).toBe(true);
    expect(offered("review").has("--wait")).toBe(true);
    expect(offered("show").has("--wait")).toBe(false);
  });

  test("zsh escapes backslashes before colons in _describe entries", () => {
    expect(describeEntry("a:b", "d")).toBe("'a\\:b:d'");
    expect(describeEntry("a\\b", "d")).toBe("'a\\\\b:d'");
    // a backslash right before a colon must not turn the colon escape into an escaped backslash
    expect(describeEntry("a\\:b", "d")).toBe("'a\\\\\\:b:d'");
    expect(describeEntry("it's", "o'k")).toBe("'it'\\''s:o'\\''k'");
  });

  test("--agents is a comma-separated list of agent ids", () => {
    expect(findFlag("--agents")!.list).toBe(true);
    expect(model.find((command) => command.name === "setup")!.scopes[0]!.flags.find((flag) => flag.names.includes("--agents"))!.list).toBe(true);
  });

  test("flag values come from the parser's own tables", () => {
    const flag = (name: string) => findFlag(name)!;
    expect(flag("--agent").values).toEqual(["codex", "claude-code"]);
    expect(flag("--shell").values).toEqual([...COMPLETION_SHELLS]);
    expect(flag("--agents").values).toContain("claude");
  });

  test("refs are listed lazily by git at completion time", () => {
    for (const shell of COMPLETION_SHELLS) expect(scripts[shell]).toMatch(/for-each-ref '?--format=%\(refname:short\)'? refs\/heads refs\/remotes refs\/tags/);
    // generation is pure: no generator module may spawn anything, so refs can only be read at tab time
    const dir = join(import.meta.dir, "..", "src", "utils", "completion");
    for (const file of readdirSync(dir)) expect(readFileSync(join(dir, file), "utf8")).not.toMatch(/spawn|child_process|execSync/);
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
    const bash = findBash();
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
