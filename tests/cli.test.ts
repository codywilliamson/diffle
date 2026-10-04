import { describe, expect, test } from "bun:test";
import { helpFor, parseCliArgs, USAGE } from "../src/utils/cli";

describe("parseCliArgs", () => {
  test("defaults: working tree, random port, open browser", () => {
    expect(parseCliArgs([])).toEqual({ command: "review", mcpAction: undefined, agent: undefined, spec: undefined, scope: undefined, reviewId: undefined, port: 0, open: true, yes: false, all: false, fix: false, check: false, remove: false, agents: undefined, help: false, version: false, license: false });
  });

  test("first positional arg is the ref spec", () => {
    expect(parseCliArgs(["staged"]).spec).toBe("staged");
    expect(parseCliArgs(["main..feature"]).spec).toBe("main..feature");
  });

  test("help and version flags (short + long)", () => {
    expect(parseCliArgs(["--help"]).help).toBe(true);
    expect(parseCliArgs(["-h"]).help).toBe(true);
    expect(parseCliArgs(["--version"]).version).toBe(true);
    expect(parseCliArgs(["-v"]).version).toBe(true);
    expect(parseCliArgs(["--license"]).license).toBe(true);
  });

  test("--port parses its value", () => {
    expect(parseCliArgs(["--port", "8080"]).port).toBe(8080);
    expect(parseCliArgs(["-p", "3000"]).port).toBe(3000);
  });

  test("--no-open disables the browser", () => {
    expect(parseCliArgs(["--no-open"]).open).toBe(false);
  });

  test("flags combine with a ref spec in any order", () => {
    const opts = parseCliArgs(["--no-open", "origin/main", "-p", "4000"]);
    expect(opts).toEqual({ command: "review", mcpAction: undefined, agent: undefined, spec: "origin/main", scope: undefined, reviewId: undefined, port: 4000, open: false, yes: false, all: false, fix: false, check: false, remove: false, agents: undefined, help: false, version: false, license: false });
  });

  test("rejects a bad port", () => {
    expect(() => parseCliArgs(["--port"])).toThrow("--port needs a number");
    expect(() => parseCliArgs(["--port", "abc"])).toThrow("--port needs a number");
    expect(() => parseCliArgs(["--port", "70000"])).toThrow("--port needs a number");
    expect(() => parseCliArgs(["--port", "0"])).toThrow("--port needs a number");
  });

  test("rejects unknown flags and extra positionals", () => {
    expect(() => parseCliArgs(["--bogus"])).toThrow("unknown option: --bogus");
    expect(() => parseCliArgs(["a", "b"])).toThrow("unexpected argument: b");
  });

  test("parses the browse command", () => {
    expect(parseCliArgs(["browse"]).spec).toBe("browse");
    expect(parseCliArgs(["browse"]).scope).toBeUndefined();
  });

  test("browse accepts an optional path scope", () => {
    const opts = parseCliArgs(["browse", "src/"]);
    expect(opts.spec).toBe("browse");
    expect(opts.scope).toBe("src/");
  });

  test("a second positional is only allowed after browse", () => {
    expect(() => parseCliArgs(["main", "src/"])).toThrow("unexpected argument: src/");
  });

  test("usage documents browse", () => {
    expect(helpFor("review", "review")).toContain("browse [path]");
  });

  test("usage covers every option", () => {
    for (const flag of ["--port", "--no-open", "--review-id", "--version", "--license", "--help"]) {
      expect(helpFor("review", "review")).toContain(flag);
    }
  });

  test("parses the MCP server command and durable review id", () => {
    expect(parseCliArgs(["mcp", "serve"]).command).toBe("mcp");
    expect(parseCliArgs(["--review-id", "r1"]).reviewId).toBe("r1");
    expect(() => parseCliArgs(["mcp", "nope"])).toThrow("mcp requires one of: serve, list, restart");
  });

  test("parses the mcp list and restart commands", () => {
    expect(parseCliArgs(["mcp", "serve"]).mcpAction).toBe("serve");
    expect(parseCliArgs(["mcp", "list"]).mcpAction).toBe("list");
    const restart = parseCliArgs(["mcp", "restart", "--yes"]);
    expect(restart.mcpAction).toBe("restart");
    expect(restart.yes).toBe(true);
    expect(parseCliArgs(["sessions"]).mcpAction).toBeUndefined();
    expect(() => parseCliArgs(["mcp", "list", "--yes"])).toThrow("only mcp restart accepts it");
    expect(() => parseCliArgs(["mcp", "restart", "extra"])).toThrow("unexpected argument: extra");
    expect(USAGE).toContain("mcp restart");
  });

  test("parses optional completion hooks", () => {
    expect(parseCliArgs(["hook", "stop", "--agent", "claude-code"]).agent).toBe("claude-code");
    expect(() => parseCliArgs(["hook", "stop", "--agent", "other"])).toThrow("--agent must be");
  });

  test("parses the sessions command", () => {
    expect(parseCliArgs(["sessions"]).command).toBe("sessions");
    expect(() => parseCliArgs(["sessions", "extra"])).toThrow("unexpected argument: extra");
  });

  test("parses the cleanup command with --yes and --all", () => {
    const opts = parseCliArgs(["cleanup", "--yes", "--all"]);
    expect(opts.command).toBe("cleanup");
    expect(opts.yes).toBe(true);
    expect(opts.all).toBe(true);
    expect(() => parseCliArgs(["cleanup", "extra"])).toThrow("unexpected argument: extra");
  });

  test("--yes and --all are rejected outside cleanup", () => {
    expect(() => parseCliArgs(["--yes"])).toThrow("unexpected argument: --yes (review accepts options only)");
    expect(() => parseCliArgs(["--all"])).toThrow("unexpected argument: --all (review accepts options only)");
    expect(() => parseCliArgs(["sessions", "--yes"])).toThrow("unexpected argument: --yes (sessions accepts options only)");
    expect(() => parseCliArgs(["mcp", "serve", "--all"])).toThrow("unexpected argument: --all (mcp accepts options only)");
    expect(() => parseCliArgs(["hook", "stop", "--agent", "codex", "--yes"])).toThrow("unexpected argument: --yes (hook accepts options only)");
  });

  test("usage documents sessions, cleanup, and update", () => {
    expect(USAGE).toContain("diffle sessions");
    expect(USAGE).toContain("diffle cleanup");
    expect(USAGE).toContain("diffle update");
    expect(helpFor("cleanup")).toContain("--yes");
    expect(helpFor("cleanup")).toContain("--all");
  });

  test("parses the doctor command with --fix and --yes", () => {
    const opts = parseCliArgs(["doctor", "--fix", "--yes"]);
    expect(opts.command).toBe("doctor");
    expect(opts.fix).toBe(true);
    expect(opts.yes).toBe(true);
    expect(parseCliArgs(["doctor"]).fix).toBe(false);
    expect(() => parseCliArgs(["doctor", "extra"])).toThrow("unexpected argument: extra");
    expect(() => parseCliArgs(["doctor", "--all"])).toThrow("unexpected argument: --all (doctor accepts options only)");
  });

  test("--fix is rejected outside doctor", () => {
    expect(() => parseCliArgs(["--fix"])).toThrow("unexpected argument: --fix (review accepts options only)");
    expect(() => parseCliArgs(["cleanup", "--fix"])).toThrow("unexpected argument: --fix (cleanup accepts options only)");
  });

  test("usage documents diagnostics", () => {
    expect(USAGE).toContain("doctor");
    expect(USAGE).toContain("diffle doctor");
    expect(helpFor("doctor")).toContain("--fix");
  });

  test("update takes only --check", () => {
    expect(parseCliArgs(["update"])).toMatchObject({ command: "update", check: false });
    expect(parseCliArgs(["update", "--check"])).toMatchObject({ command: "update", check: true });
    expect(() => parseCliArgs(["update", "--yes"])).toThrow("unexpected argument: --yes (update accepts options only)");
  });

  test("--check is rejected outside update", () => {
    expect(() => parseCliArgs(["--check"])).toThrow("unexpected argument: --check (review accepts options only)");
    expect(() => parseCliArgs(["doctor", "--check"])).toThrow("unexpected argument: --check (doctor accepts options only)");
    expect(() => parseCliArgs(["cleanup", "--check"])).toThrow("unexpected argument: --check (cleanup accepts options only)");
  });

  test("setup parses --remove, --agents and --yes", () => {
    expect(parseCliArgs(["setup"])).toMatchObject({ command: "setup", remove: false, agents: undefined, yes: false });
    expect(parseCliArgs(["setup", "--remove", "--yes"])).toMatchObject({ command: "setup", remove: true, yes: true });
    expect(parseCliArgs(["setup", "--agents", "claude, cursor,"]).agents).toEqual(["claude", "cursor"]);
  });

  test("--agents needs a list", () => {
    expect(() => parseCliArgs(["setup", "--agents"])).toThrow("--agents needs");
    expect(() => parseCliArgs(["setup", "--agents", ","])).toThrow("--agents needs");
  });

  test("setup flags are rejected on other commands", () => {
    expect(() => parseCliArgs(["--remove"])).toThrow("unexpected argument: --remove (review accepts options only)");
    expect(() => parseCliArgs(["doctor", "--remove"])).toThrow("unexpected argument: --remove (doctor accepts options only)");
    expect(() => parseCliArgs(["--agents", "claude"])).toThrow("unexpected argument: --agents (review accepts options only)");
    expect(() => parseCliArgs(["cleanup", "--agents", "claude"])).toThrow("unexpected argument: --agents");
  });

  test("other commands' flags are rejected on setup", () => {
    expect(() => parseCliArgs(["setup", "--fix"])).toThrow("unexpected argument: --fix (setup accepts options only)");
    expect(() => parseCliArgs(["setup", "--all"])).toThrow("unexpected argument: --all (setup accepts options only)");
    expect(() => parseCliArgs(["setup", "claude"])).toThrow("unexpected argument: claude (setup accepts options only)");
  });

  test("usage documents setup", () => {
    expect(USAGE).toContain("diffle setup [--remove] [--agents <ids>] [--yes]");
  });

  test("usage documents update --check and the launch-notice opt-out", () => {
    expect(USAGE).toContain("diffle update [--check]");
    expect(helpFor("update")).toContain("DIFFLE_NO_UPDATE_CHECK=1");
  });

  test("help is valid after any command, including mcp and hook without a subcommand", () => {
    for (const command of ["mcp", "hook", "sessions", "cleanup", "update", "doctor", "setup"] as const) {
      for (const flag of ["--help", "-h"]) {
        const opts = parseCliArgs([command, flag]);
        expect(opts.help).toBe(true);
        expect(opts.command).toBe(command);
      }
    }
    expect(parseCliArgs(["mcp", "restart", "--help"]).mcpAction).toBe("restart");
    expect(parseCliArgs(["mcp", "--help"]).mcpAction).toBeUndefined();
    expect(() => parseCliArgs(["mcp", "bogus"])).toThrow("mcp requires one of");
  });

  test("per-command help covers usage, options, examples, and related commands", () => {
    const mcp = helpFor("mcp");
    expect(mcp).toContain("diffle mcp restart [--yes]");
    expect(mcp).toContain("--yes");
    expect(mcp).toContain("Examples");
    expect(mcp).toContain("See also: diffle update");
    expect(helpFor("update")).toContain("--check");
    expect(helpFor("setup")).toContain("--agents <ids>");
  });

  test("overview lists every command, common tasks, examples, and the docs footer", () => {
    for (const text of ["Common tasks", "Examples", "diffle mcp restart", "diffle setup", "diffle cleanup", "diffle <command> --help", "https://diffle.dev/reference/cli/"]) {
      expect(USAGE).toContain(text);
    }
    expect(helpFor("review")).toBe(USAGE);
    expect(helpFor("review", "main")).toBe(USAGE);
    expect(helpFor("review", "review")).toContain("review a diff in the browser");
  });
});
