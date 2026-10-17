// first-run migration: swaps the retired review plugins (diffle-review, loupe-review) for
// nittle-review and points every agent's mcp config at nittle, with no prompt. a no-op (a few
// file reads) when no agent carries a retired plugin or config. anything it can't finish is left
// for `nittle doctor`, and the next run retries.

import { homedir } from "node:os";
import { agentTargets, serverCommand, type AgentEnv, type AgentTarget } from "../agentTargets";
import { runQuiet, type RunCommand } from "../agentSetup";
import { stopLegacyMcpServers } from "../mcpProcesses";
import { PRODUCT } from "../product";
import { configPath, configState, rewriteConfig, type ConfigState } from "./agentPluginsConfigs";
import { planPluginSwap, runPluginSwap, type PluginSwapStep } from "./agentPluginsSwap";
import type { MigrationStep } from "./runner";

export interface AgentPluginsDeps {
  agentEnv: AgentEnv;
  run: RunCommand;
  which: (bin: string) => string | null;
  log: (line: string) => void;
  stopServers: () => unknown;
}

export interface AgentFinding { target: AgentTarget; steps: PluginSwapStep[]; config: ConfigState; }

const TAG =`[${PRODUCT.name}]`;
const DOCTOR_HINT = `run \`${PRODUCT.name} doctor --fix\``;

export function defaultAgentPluginsDeps(): AgentPluginsDeps {
  const home = homedir();
  return {
    agentEnv: { home, platform: process.platform, env: process.env, command: serverCommand(process.execPath, home) },
    run: runQuiet, which: (bin) => Bun.which(bin), log: (line) => console.error(line), stopServers: stopLegacyMcpServers,
  };
}

export function findLegacyAgents(agentEnv: AgentEnv): AgentFinding[] {
  return agentTargets(agentEnv)
    .map((target) => ({ target, steps: planPluginSwap(target), config: configState(target) }))
    .filter((finding) => finding.steps.length > 0 || finding.config !== "clean");
}

export interface FindingOutcome { line: string; left: string[]; }

export function migrateFinding({ target, steps, config }: AgentFinding, deps: AgentPluginsDeps): FindingOutcome {
  const parts: string[] = [];
  const left: string[] = [];
  const { integration } = target;
  if (steps.length > 0 && integration.kind === "plugin") {
    if (!deps.which(integration.cli)) left.push(`\`${integration.cli}\` is not on PATH`);
    else {
      const outcome = runPluginSwap(target, steps, deps.run);
      if (outcome.removed.length > 0) parts.push(`removed ${outcome.removed.length} retired plugin step(s)`);
      if (outcome.installed) parts.push(`installed ${PRODUCT.plugin.name}`);
      left.push(...outcome.failed.map((label) => `${label} failed`));
    }
  }
  if (config !== "clean") {
    const result = rewriteConfig(target, deps.agentEnv.command ?? PRODUCT.name);
    if (result === "rewritten") parts.push(`${configPath(target)} now launches ${PRODUCT.name}`);
    else if (result === "unreadable") left.push(`${configPath(target)} can't be edited automatically`);
  }
  const summary = parts.length > 0 ? parts.join(", ") : "nothing changed";
  return { left, line: `${TAG} ${target.displayName}: ${summary}${left.length > 0 ? ` — left: ${left.join("; ")} (${DOCTOR_HINT})` : ""}` };
}

// returns the summary lines it logged
export function migrateAgentPlugins(overrides: Partial<AgentPluginsDeps> = {}): string[] {
  const deps = { ...defaultAgentPluginsDeps(), ...overrides };
  const findings = findLegacyAgents(deps.agentEnv);
  if (findings.length === 0) return [];
  deps.stopServers();
  const lines = findings.map((finding) => migrateFinding(finding, deps).line);
  for (const line of lines) deps.log(line);
  return lines;
}

export function createAgentPluginsStep(overrides: Partial<AgentPluginsDeps> = {}): MigrationStep {
  return { name: "agent-plugins", run: () => migrateAgentPlugins(overrides).join("\n") };
}
