// `diffle setup` — wire diffle into coding agents (plugin install or mcp config edit), or unwire it.

import { PRODUCT } from "../core/product";
import { agentTargets, isDetected, type AgentTarget } from "../core/agentTargets";
import { applyAgent, runInherited, type RunCommand, type SetupMode, type StepResult } from "../core/agentSetup";
import { confirmProceed } from "./confirm";
import { promptMultiSelect, type SelectItem } from "./multiSelect";
import { cliMissing, planLines, type Style } from "./setupPlan";

export interface SetupOptions { remove: boolean; agents: string[] | undefined; yes: boolean; }
export interface SetupDeps {
  targets: AgentTarget[];
  run: RunCommand;
  which: (bin: string) => string | null;
  exists?: (path: string) => boolean;
  interactive: boolean;
  select: (title: string, items: SelectItem<AgentTarget>[]) => Promise<AgentTarget[] | undefined>;
  confirm: (yes: boolean) => Promise<boolean>;
  log: (line: string) => void;
  color: boolean;
}

const CANCELLED = 130;
const RESTART_HINT = "done — restart your agents (or start a new session) to pick up the changes";
const ICON: Record<StepResult["status"], string> = { ok: "✓", skipped: "–", failed: "✗" };

const paint = (color: boolean, code: string) => (s: string) => (color ? `\x1b[${code}m${s}\x1b[0m` : s);

const palette = (color: boolean) => ({
  accent: paint(color, PRODUCT.accent), bold: paint(color, "1"), dim: paint(color, "2"),
  green: paint(color, "32"), red: paint(color, "31"),
});

export function defaultSetupDeps(): SetupDeps {
  return {
    targets: agentTargets(), run: runInherited, which: (bin) => Bun.which(bin),
    interactive: process.stdin.isTTY === true, select: promptMultiSelect, confirm: confirmProceed,
    log: console.log, color: process.stdout.isTTY === true,
  };
}

// throws a user-facing message on an unknown id; keeps registry order
export function resolveAgents(ids: string[], targets: AgentTarget[]): AgentTarget[] {
  const unknown = ids.filter((id) => !targets.some((target) => target.id === id));
  if (unknown.length > 0) throw new Error(`unknown agent: ${unknown.join(", ")} (valid: ${targets.map((t) => t.id).join(", ")})`);
  return targets.filter((target) => ids.includes(target.id));
}

// returns the process exit code
export async function runSetup(opts: SetupOptions, overrides: Partial<SetupDeps> = {}): Promise<number> {
  const deps = { ...defaultSetupDeps(), ...overrides };
  const { log } = deps;
  const mode: SetupMode = opts.remove ? "remove" : "install";
  const { accent, bold, dim, green, red } = palette(deps.color);
  const style: Style = { bold, dim };
  const detected = (target: AgentTarget) => isDetected(target, deps.which, deps.exists);

  let chosen: AgentTarget[] | undefined;
  try {
    chosen = opts.agents ? resolveAgents(opts.agents, deps.targets) : undefined;
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    return 1;
  }

  log(accent(bold(`${PRODUCT.name} setup${opts.remove ? " --remove" : ""}`)));

  if (!chosen) {
    if (!deps.interactive) {
      const found = deps.targets.filter(detected).map((target) => target.id);
      log(`no terminal to prompt in — pass --agents <ids> (detected: ${found.join(", ") || "none"})`);
      log(`valid ids: ${deps.targets.map((target) => target.id).join(", ")}`);
      return 1;
    }
    const ordered = [...deps.targets.filter(detected), ...deps.targets.filter((target) => !detected(target))];
    const items = ordered.map((target) => ({
      label: target.displayName,
      hint: detected(target) ? "(detected)" : undefined,
      value: target,
      checked: !opts.remove && detected(target),
    }));
    const title = opts.remove ? `Select agents to remove ${PRODUCT.name} from:` : "Select agents to set up:";
    chosen = await deps.select(title, items);
    // cancel exits non-zero so callers (the uninstaller) don't mistake it for a finished run
    if (!chosen) { log("cancelled"); return CANCELLED; }
    if (chosen.length === 0) { log("nothing selected"); return 0; }
  }

  log("");
  const missing = new Map(chosen.map((target) => [target.id, cliMissing(target, deps.which)]));
  for (const target of chosen) for (const line of planLines(target, mode, opts.yes, missing.get(target.id) === true, style)) log(line);

  const runnable = chosen.filter((target) => !missing.get(target.id));
  if (runnable.length === 0) { log("\nnothing to run"); return 0; }
  log("");
  if (!(await deps.confirm(opts.yes))) { log("cancelled"); return CANCELLED; }

  let failed = false;
  for (const [index, target] of runnable.entries()) {
    if (index > 0) log("");
    log(bold(target.displayName));
    for (const result of applyAgent(target, mode, opts.yes, deps.run)) {
      const icon = (result.status === "ok" ? green : result.status === "failed" ? red : dim)(ICON[result.status]);
      log(`  ${icon} ${result.status === "skipped" ? dim(result.text) : result.text}`);
      for (const line of result.detail?.split("\n") ?? []) log(`      ${line}`);
      if (result.status === "failed") failed = true;
    }
  }
  log("");
  if (failed) log(red("finished with errors — see the failed steps above"));
  else log(opts.remove ? "done" : green(RESTART_HINT));
  return failed ? 1 : 0;
}
