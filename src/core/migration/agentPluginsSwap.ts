// plans and runs the retired-plugin -> nittle-review swap for the two agents with a plugin cli
// (claude code, codex). detection reads each agent's registry files; the cli does the changes.

import { readFileSync } from "node:fs";
import { dirname } from "node:path";
import { isPluginInstalled, type AgentTarget, type PluginIntegration } from "../agentTargets";
import { pluginStepArgs, type RunCommand } from "../agentSetup";
import { marketplaceState } from "../marketplaceState";
import { PRODUCT } from "../product";
import { diagnoseClaudePlugins, readClaudePluginState } from "../../utils/claudePlugins";

export interface PluginSwapStep { args: string[]; kind: "remove" | "install"; label: string; }
export interface SwapOutcome { removed: string[]; installed: boolean; failed: string[]; }

const PRODUCT_REF = `${PRODUCT.plugin.name}@${PRODUCT.plugin.marketplace}`;

function claudeSteps(integration: PluginIntegration): PluginSwapStep[] {
  const state = readClaudePluginState(dirname(dirname(integration.registry)));
  const legacyPresent = state.legacy.length + state.legacyEnabled.length + state.legacyMarketplaces.length + state.legacyMcpServers.length > 0;
  if (!legacyPresent) return [];
  return diagnoseClaudePlugins(state).plan.map((step) => ({
    args: step.args, kind: step.args[1] === "install" || step.args[2] === "add" ? "install" : "remove", label: step.describe,
  }));
}

function codexSteps(integration: PluginIntegration): PluginSwapStep[] {
  let text = "";
  try { text = readFileSync(integration.registry, "utf8"); } catch { return []; }
  const steps: PluginSwapStep[] = [];
  for (const { name, marketplace } of PRODUCT.retiredPlugins) {
    for (const ref of [`${name}@${marketplace}`, `${name}-hook@${marketplace}`]) {
      if (text.includes(JSON.stringify(ref))) steps.push({ args: ["plugin", "remove", ref], kind: "remove", label: `remove ${ref}` });
    }
  }
  for (const { marketplace } of PRODUCT.retiredPlugins) {
    if (new RegExp(`^\\s*\\[marketplaces\\.("?)${marketplace}\\1\\]`, "m").test(text)) {
      steps.push({ args: ["plugin", "marketplace", "remove", marketplace], kind: "remove", label: `unregister ${marketplace}` });
    }
  }
  if (steps.length === 0) return [];
  if (!isPluginInstalled(integration)) {
    steps.push(...integration.install.map((args): PluginSwapStep => ({ args, kind: "install", label: `install ${PRODUCT_REF}` })));
  }
  return steps;
}

// empty when the agent has no retired plugin (or marketplace) registered
export function planPluginSwap(target: AgentTarget): PluginSwapStep[] {
  const { integration } = target;
  if (integration.kind !== "plugin") return [];
  const steps = integration.cli === "claude" ? claudeSteps(integration) : codexSteps(integration);
  // install first: if it fails, the retired markers stay so the next pass (and doctor) still see the work
  return [...steps.filter((step) => step.kind === "install"), ...steps.filter((step) => step.kind === "remove")];
}

// a retry re-adds a marketplace the first pass already registered. that failure is fine when the
// registered entry is verifiably ours; a foreign or unreadable registration still stops the swap.
export function marketplaceAlreadyOurs(integration: PluginIntegration, args: string[]): boolean {
  return args[1] === "marketplace" && args[2] === "add" && ["ours", "outdated"].includes(marketplaceState(integration.marketplaceSources));
}

// runs the steps in plan order; stops at the first failing step, leaving later removals undone
export function runPluginSwap(target: AgentTarget, steps: PluginSwapStep[], run: RunCommand): SwapOutcome {
  const outcome: SwapOutcome = { removed: [], installed: false, failed: [] };
  const { integration } = target;
  if (integration.kind !== "plugin") return outcome;
  for (const step of steps) {
    let code = -1;
    try { code = run(integration.cli, pluginStepArgs(integration.cli, step.args, true)); } catch { /* spawn failure = failed step */ }
    if (code !== 0 && !marketplaceAlreadyOurs(integration, step.args)) { outcome.failed.push(step.label); break; }
    if (step.kind === "remove") outcome.removed.push(step.label);
    else outcome.installed = true;
  }
  return outcome;
}
