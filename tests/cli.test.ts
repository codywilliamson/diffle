import { describe, expect, test } from "bun:test";
import { parseCliArgs, USAGE } from "../src/utils/cli";

describe("parseCliArgs", () => {
  test("defaults: working tree, random port, open browser", () => {
    expect(parseCliArgs([])).toEqual({ command: "review", agent: undefined, spec: undefined, scope: undefined, reviewId: undefined, port: 0, open: true, yes: false, all: false, fix: false, check: false, help: false, version: false });
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
    expect(opts).toEqual({ command: "review", agent: undefined, spec: "origin/main", scope: undefined, reviewId: undefined, port: 4000, open: false, yes: false, all: false, fix: false, check: false, help: false, version: false });
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
    expect(USAGE).toContain("browse [path]");
  });

  test("usage covers every option", () => {
    for (const flag of ["--port", "--no-open", "--review-id", "--version", "--help"]) {
      expect(USAGE).toContain(flag);
    }
  });

  test("parses the MCP server command and durable review id", () => {
    expect(parseCliArgs(["mcp", "serve"]).command).toBe("mcp");
    expect(parseCliArgs(["--review-id", "r1"]).reviewId).toBe("r1");
    expect(() => parseCliArgs(["mcp", "nope"])).toThrow("mcp requires the serve command");
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
    expect(USAGE).toContain("--yes");
    expect(USAGE).toContain("--all");
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
    expect(USAGE).toContain("Diagnostics");
    expect(USAGE).toContain("diffle doctor");
    expect(USAGE).toContain("--fix");
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

  test("usage documents update --check and the launch-notice opt-out", () => {
    expect(USAGE).toContain("diffle update [--check]");
    expect(USAGE).toContain("DIFFLE_NO_UPDATE_CHECK=1");
  });
});
