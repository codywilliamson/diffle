import { afterEach, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { resolveAgents, runSetup, type SetupDeps } from "../src/utils/setupCli";
import { agentTargets, type AgentTarget } from "../src/core/agentTargets";
import { cliMissing, planLines } from "../src/utils/setupPlan";
import { cleanupTempDirs, tempDir } from "./helpers/claudeConfig";

afterEach(cleanupTempDirs);

const plain = { bold: (s: string) => s, dim: (s: string) => s };

function harness(overrides: Partial<SetupDeps> = {}) {
  const home = tempDir();
  const lines: string[] = [];
  const calls: string[][] = [];
  const deps: Partial<SetupDeps> = {
    targets: agentTargets({ home, platform: "linux", env: {} }),
    which: () => null,
    exists: () => false,
    interactive: false,
    log: (line) => lines.push(line),
    color: false,
    run: (cli, args) => { calls.push([cli, ...args]); return 0; },
    confirm: async () => true,
    ...overrides,
  };
  return { home, lines, calls, deps, text: () => lines.join("\n") };
}

test("non-tty without --agents prints the hint and fails", async () => {
  const { deps, text } = harness();
  expect(await runSetup({ remove: false, agents: undefined, yes: false }, deps)).toBe(1);
  expect(text()).toContain("no terminal to prompt in — pass --agents <ids> (detected: none)");
  expect(text()).toContain("valid ids: claude, codex, cursor");
});

test("unknown agent id errors with the valid list", async () => {
  const { deps } = harness();
  const errors: string[] = [];
  const original = console.error;
  console.error = (msg: string) => errors.push(msg);
  try {
    expect(await runSetup({ remove: false, agents: ["nope"], yes: true }, deps)).toBe(1);
  } finally { console.error = original; }
  expect(errors[0]).toContain("unknown agent: nope (valid: claude, codex, cursor");
});

test("resolveAgents keeps registry order", () => {
  const targets = agentTargets({ home: "/h", platform: "linux", env: {} });
  expect(resolveAgents(["zed", "claude"], targets).map((t) => t.id)).toEqual(["claude", "zed"]);
});

test("--agents installs mcp configs, then removes them", async () => {
  const { deps, text, home } = harness();
  expect(await runSetup({ remove: false, agents: ["cursor", "gemini"], yes: true }, deps)).toBe(0);
  expect(text()).toContain("edit ");
  expect(text()).toContain("✓ created →");
  expect(text()).toContain("done — restart your agents");
  expect(await runSetup({ remove: true, agents: ["cursor"], yes: true }, deps)).toBe(0);
  expect(text()).toContain("✓ removed →");
  expect(existsSync(join(home, ".gemini", "settings.json"))).toBe(true);
});

test("declined confirmation cancels without changes", async () => {
  const { deps, text, home } = harness({ confirm: async () => false });
  expect(await runSetup({ remove: false, agents: ["cursor"], yes: false }, deps)).toBe(130);
  expect(text()).toContain("cancelled");
  expect(existsSync(join(home, ".cursor", "mcp.json"))).toBe(false);
});

test("cancelling the picker exits non-zero, unlike an empty selection", async () => {
  const { deps, text } = harness({ interactive: true, select: async () => undefined });
  expect(await runSetup({ remove: true, agents: undefined, yes: false }, deps)).toBe(130);
  expect(text()).toContain("cancelled");
});

test("empty selection exits cleanly; prompt is detected-first and pre-checked", async () => {
  let seen: { title: string; labels: string[]; hints: (string | undefined)[]; checked: boolean[] } | undefined;
  const { deps, text } = harness({
    interactive: true,
    which: (bin) => (bin === "gemini" ? "/bin/gemini" : null),
    select: async (title, items) => {
      seen = { title, labels: items.map((i) => i.label), hints: items.map((i) => i.hint), checked: items.map((i) => i.checked) };
      return [];
    },
  });
  expect(await runSetup({ remove: false, agents: undefined, yes: false }, deps)).toBe(0);
  expect(text()).toContain("nothing selected");
  expect(seen!.title).toBe("Select agents to set up:");
  expect(seen!.labels[0]).toBe("Gemini CLI");
  expect(seen!.hints[0]).toBe("(detected)");
  expect(seen!.checked[0]).toBe(true);
  expect(seen!.checked.slice(1).every((c) => !c)).toBe(true);
});

const registeredCursor = (target: AgentTarget) => target.id === "cursor";

test("remove prompt pre-checks only agents diffle is wired into, first", async () => {
  let seen: { title: string; ids: string[]; hints: (string | undefined)[]; checked: boolean[] } | undefined;
  const { deps } = harness({
    interactive: true,
    which: () => "/bin/x",
    registered: registeredCursor,
    select: async (title, items) => {
      seen = { title, ids: items.map((i) => i.value.id), hints: items.map((i) => i.hint), checked: items.map((i) => i.checked) };
      return undefined;
    },
  });
  await runSetup({ remove: true, agents: undefined, yes: false }, deps);
  expect(seen!.title).toBe("Select agents to remove diffle from:");
  expect(seen!.ids[0]).toBe("cursor");
  expect(seen!.hints[0]).toBe("(set up)");
  expect(seen!.checked).toEqual([true, ...seen!.checked.slice(1).map(() => false)]);
});

test("an empty removal is fine when nothing is wired up", async () => {
  const { deps, text } = harness({ interactive: true, registered: () => false, select: async () => [] });
  expect(await runSetup({ remove: true, agents: undefined, yes: false }, deps)).toBe(0);
  expect(text()).toContain("nothing selected");
});

test("deselecting a wired-up agent exits non-zero so the uninstaller keeps the binary", async () => {
  const empty = harness({ interactive: true, registered: registeredCursor, select: async () => [] });
  expect(await runSetup({ remove: true, agents: undefined, yes: false }, empty.deps)).toBe(130);

  const partial = harness({
    interactive: true,
    registered: (target) => target.id === "cursor" || target.id === "gemini",
    select: async (_title, items) => items.filter((i) => i.value.id === "cursor").map((i) => i.value),
  });
  expect(await runSetup({ remove: true, agents: undefined, yes: true }, partial.deps)).toBe(1);
  expect(partial.text()).toContain("still set up (not selected): Gemini CLI");
});

test("plugin cli missing: plan lists commands and nothing runs", async () => {
  const { deps, text, calls } = harness();
  expect(await runSetup({ remove: false, agents: ["claude"], yes: true }, deps)).toBe(0);
  expect(text()).toContain("`claude` not on PATH — install it or run these yourself:");
  expect(text()).toContain("claude plugin install");
  expect(calls).toEqual([]);
});

test("removal with a plugin cli missing still runs the rest but exits 1", async () => {
  const { deps, text } = harness();
  expect(await runSetup({ remove: true, agents: ["claude"], yes: true }, deps)).toBe(1);
  expect(await runSetup({ remove: true, agents: ["claude", "cursor"], yes: true }, deps)).toBe(1);
  expect(text()).toContain("nothing to remove in");
  expect(text()).toContain("finished with errors");
});

test("plugin failure gives exit code 1", async () => {
  const { deps, text } = harness({ which: () => "/bin/claude", run: (_c, args) => (args[1] === "install" ? 1 : 0) });
  expect(await runSetup({ remove: false, agents: ["claude"], yes: true }, deps)).toBe(1);
  expect(text()).toContain("✗");
  expect(text()).toContain("finished with errors");
});

test("plan rendering", () => {
  const targets = agentTargets({ home: "/h", platform: "linux", env: {} });
  const find = (id: string): AgentTarget => targets.find((t) => t.id === id)!;
  const claude = planLines(find("claude"), "install", true, false, plain);
  expect(claude[0]).toBe("Claude Code");
  expect(claude[1]).toStartWith("  run  claude plugin marketplace add ");
  expect(claude[2]).toEndWith("--yes");
  expect(planLines(find("cursor"), "install", true, false, plain)[1]).toMatch(/^ {2}edit .*mcp\.json {2}\(mcpServers\.diffle\)$/);
  expect(cliMissing(find("claude"), () => null)).toBe(true);
  expect(cliMissing(find("cursor"), () => null)).toBe(false);
});
