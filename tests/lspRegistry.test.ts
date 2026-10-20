import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { delimiter, join } from "node:path";
import { LSP_LANGUAGES, LSP_REGISTRY, languageForPath, type LspLanguage } from "../src/core/lsp/registry";
import { mergeOverrides, parseOverrideFlag, splitCommandLine } from "../src/core/lsp/overrides";
import { ServerResolver } from "../src/core/lsp/serverResolver";
import { readUserState, writeUserState } from "../src/core/userState";
import { parseCliArgs } from "../src/utils/cli";
import { lspOverrideLines, lspStatusLines, runLspCommand } from "../src/utils/lspCli";
import { tempDir } from "./helpers/fakeLspPool";

const WIN = process.platform === "win32";

// an executable named `name` in `dir` that does nothing; the resolver only needs it to exist.
function shim(dir: string, name: string): string {
  mkdirSync(dir, { recursive: true });
  const file = join(dir, WIN ? `${name}.cmd` : name);
  writeFileSync(file, WIN ? "@echo off\r\n" : "#!/bin/sh\n");
  if (!WIN) chmodSync(file, 0o755);
  return file;
}

const resolverOn = (searchPath: string, extra: Partial<ConstructorParameters<typeof ServerResolver>[0]> = {}) =>
  new ServerResolver({ root: tempDir("repo"), searchPath, ...extra });

const resolvers: ServerResolver[] = [];
const track = (resolver: ServerResolver) => { resolvers.push(resolver); return resolver; };
afterEach(() => { for (const resolver of resolvers.splice(0)) resolver.cleanup(); });

describe("registry", () => {
  it("every language has an install hint, a candidate and an extension", () => {
    for (const language of LSP_LANGUAGES) {
      const entry = LSP_REGISTRY[language];
      expect(entry.installHint.trim().length, language).toBeGreaterThan(0);
      expect(entry.candidates.length, language).toBeGreaterThan(0);
      expect(Object.keys(entry.languageIds).length, language).toBeGreaterThan(0);
    }
  });

  it("covers the requested languages and keeps typescript and csharp", () => {
    expect(LSP_LANGUAGES).toEqual(expect.arrayContaining(["typescript", "csharp", "python", "go", "rust", "vue", "svelte"]));
    for (const [path, language] of ([["a.py", "python"], ["a.go", "go"], ["a.rs", "rust"], ["a.vue", "vue"], ["a.svelte", "svelte"], ["a.ts", "typescript"], ["a.cs", "csharp"]] as [string, LspLanguage][])) {
      expect(languageForPath(path)?.language).toBe(language);
    }
  });

  it("python tries pyrefly then basedpyright", () => {
    const [first, second] = LSP_REGISTRY.python.candidates;
    expect([first?.command, first?.args("")]).toEqual(["pyrefly", ["lsp"]]);
    expect([second?.command, second?.args("")]).toEqual(["basedpyright-langserver", ["--stdio"]]);
  });
});

describe("resolving", () => {
  it("python falls back to basedpyright when pyrefly is missing", () => {
    const bin = tempDir("bin");
    const fallback = shim(bin, "basedpyright-langserver");
    const spec = track(resolverOn(bin)).resolve("python");
    expect(spec?.command).toBe(fallback);
    expect(spec?.args).toEqual(["--stdio"]);
  });

  it("an active virtualenv is searched first and handed to the server", () => {
    const bin = tempDir("bin");
    shim(bin, "pyrefly");
    const venv = tempDir("venv");
    const venvPyrefly = shim(join(venv, WIN ? "Scripts" : "bin"), "pyrefly");
    const environment = { VIRTUAL_ENV: venv, PATH: bin };
    const spec = track(resolverOn(bin, { environment, excludeRoots: [venv] })).resolve("python");
    expect(spec?.command).toBe(venvPyrefly);
    expect(spec?.env?.VIRTUAL_ENV).toBe(venv);
    expect(spec?.env?.PATH?.split(delimiter)[0]).toBe(join(venv, WIN ? "Scripts" : "bin"));
  });

  it("ignores VIRTUAL_ENV for languages that do not use one", () => {
    const bin = tempDir("bin");
    shim(bin, "gopls");
    const venv = tempDir("venv");
    shim(join(venv, WIN ? "Scripts" : "bin"), "gopls");
    const spec = track(resolverOn(bin, { environment: { VIRTUAL_ENV: venv } })).resolve("go");
    expect(spec?.command).toBe(join(bin, WIN ? "gopls.cmd" : "gopls"));
    expect(spec?.env).toBeUndefined();
  });

  it("an override replaces the registry candidates and is split into argv without a shell", () => {
    const bin = tempDir("bin");
    const tool = shim(bin, "my-analyzer");
    shim(bin, "rust-analyzer");
    const resolver = track(resolverOn(bin, { overrides: { rust: 'my-analyzer --flag "a b" && echo hi' } }));
    const spec = resolver.resolve("rust");
    expect(spec?.command).toBe(tool);
    expect(spec?.args).toEqual(["--flag", "a b", "&&", "echo", "hi"]);
  });

  it("an empty override disables the language even when the server is installed", () => {
    const bin = tempDir("bin");
    shim(bin, "gopls");
    const resolver = track(resolverOn(bin, { overrides: { go: "" } }));
    expect(resolver.resolve("go")).toBeUndefined();
    expect(resolver.isDisabled("go")).toBe(true);
    expect(resolver.hintFor("go")).toContain("disabled");
  });
});

describe("status lines", () => {
  it("prints the resolved command, or what was tried plus the install hint", () => {
    const bin = tempDir("bin");
    const gopls = shim(bin, "gopls");
    const lines = lspStatusLines(track(resolverOn(bin)), {});
    expect(lines).toHaveLength(LSP_LANGUAGES.length);
    expect(lines.find((line) => line.startsWith("go "))).toContain(gopls);
    const python = lines.find((line) => line.startsWith("python"));
    expect(python).toContain("not on PATH (tried pyrefly, basedpyright-langserver)");
    expect(python).toContain(LSP_REGISTRY.python.installHint);
  });

  it("marks overridden and disabled languages", () => {
    const bin = tempDir("bin");
    const lines = lspStatusLines(track(resolverOn(bin, { overrides: { rust: "" } })), { rust: "" });
    expect(lines.find((line) => line.startsWith("rust"))).toContain("disabled");
  });
});

describe("override parsing", () => {
  it("splits quotes and keeps windows backslashes", () => {
    expect(splitCommandLine(String.raw`C:\tools\x.exe --a 'b c' ""`)).toEqual([String.raw`C:\tools\x.exe`, "--a", "b c", ""]);
    expect(() => splitCommandLine('x "oops')).toThrow("unterminated");
  });

  it("parses --lsp values", () => {
    expect(parseOverrideFlag("rust=rust-analyzer")).toEqual(["rust", "rust-analyzer"]);
    expect(parseOverrideFlag("rust=")).toEqual(["rust", ""]);
    expect(() => parseOverrideFlag("rust")).toThrow("<lang>=<command>");
    expect(() => parseOverrideFlag("cobol=x")).toThrow("unknown language");
  });

  it("run overrides win over stored ones, and unknown stored languages are dropped", () => {
    expect(mergeOverrides({ rust: "a", cobol: "b", go: "g" }, { rust: "c" })).toEqual({ rust: "c", go: "g" });
  });
});

describe("cli", () => {
  it("--lsp is repeatable and reaches the options", () => {
    expect(parseCliArgs(["--lsp", "rust=ra", "--lsp", "go="]).lspOverrides).toEqual({ rust: "ra", go: "" });
    expect(parseCliArgs(["show", "--lsp", "rust=ra"]).lspOverrides).toEqual({ rust: "ra" });
    expect(() => parseCliArgs(["--lsp"])).toThrow("<lang>=<command>");
  });

  it("parses lsp, lsp set and lsp unset", () => {
    expect(parseCliArgs(["lsp"])).toMatchObject({ command: "lsp", lspAction: undefined, lspTarget: undefined });
    expect(parseCliArgs(["lsp", "set", "python", "pyrefly lsp"])).toMatchObject({ lspAction: "set", lspTarget: { language: "python", command: "pyrefly lsp" } });
    expect(parseCliArgs(["lsp", "set", "go", ""]).lspTarget).toEqual({ language: "go", command: "" });
    expect(parseCliArgs(["lsp", "unset", "go"])).toMatchObject({ lspAction: "unset", lspTarget: { language: "go" } });
    expect(parseCliArgs(["lsp", "--help"]).help).toBe(true);
  });

  it("rejects bad lsp arguments", () => {
    expect(() => parseCliArgs(["lsp", "set", "python"])).toThrow("needs a language and a command");
    expect(() => parseCliArgs(["lsp", "set", "cobol", "x"])).toThrow("unknown language");
    expect(() => parseCliArgs(["lsp", "set", "go", "a", "b"])).toThrow("quote a command");
    expect(() => parseCliArgs(["lsp", "unset"])).toThrow("unknown language");
    expect(() => parseCliArgs(["lsp", "bogus"])).toThrow("lsp takes set or unset");
    expect(() => parseCliArgs(["lsp", "--lsp", "go=x"])).toThrow("unexpected argument");
  });
});

describe("stored overrides", () => {
  let logs: string[];
  beforeEach(() => {
    writeUserState({ lspOverrides: undefined });
    logs = [];
    spyOn(console, "log").mockImplementation((line: string) => { logs.push(line); });
  });
  afterEach(() => { writeUserState({ lspOverrides: undefined }); });

  it("set, list and unset round trip through the user state file", () => {
    runLspCommand("set", { language: "python", command: "pyrefly lsp" });
    runLspCommand("set", { language: "go", command: "" });
    expect(readUserState().lspOverrides).toEqual({ python: "pyrefly lsp", go: "" });
    expect(lspOverrideLines(readUserState().lspOverrides)).toEqual(["", "stored overrides", "  python = pyrefly lsp", '  go = "" (disabled)']);

    runLspCommand(undefined, undefined, tempDir("cwd"));
    const printed = logs.join("\n");
    expect(printed).toContain("stored overrides");
    expect(printed).toContain("python = pyrefly lsp");

    runLspCommand("unset", { language: "python", command: "" });
    runLspCommand("unset", { language: "go", command: "" });
    expect(readUserState().lspOverrides).toBeUndefined();
  });
});
