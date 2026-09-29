// applies (or removes) one agent's diffle integration and reports what happened per step.

import { mcpEntrySnippet, mergeMcpEntry, removeMcpEntry, type ConfigAction } from "./mcpConfigFile";
import {
  isMarketplaceRegistered, MCP_SERVER_NAME, type AgentTarget, type McpConfigIntegration, type PluginCli, type PluginIntegration,
} from "./agentTargets";

export type SetupMode = "install" | "remove";
export type StepStatus = "ok" | "skipped" | "failed";
export interface StepResult { status: StepStatus; text: string; detail?: string; }
export type RunCommand = (cli: string, args: string[]) => number;

export const runInherited: RunCommand = (cli, args) =>
  Bun.spawnSync({ cmd: [cli, ...args], stdio: ["inherit", "inherit", "inherit"] }).exitCode;

const isMarketplaceStep = (args: string[]) => args[1] === "marketplace";
const SPAWN_FAILED = -1;

// claude prompts before trusting a marketplace-declared command; --yes accepts it (codex has no such flag)
export function pluginStepArgs(cli: PluginCli, args: string[], yes: boolean): string[] {
  return yes && cli === "claude" && args[1] === "install" ? [...args, "--yes"] : args;
}

export const renderCommand = (cli: string, args: string[]) => `${cli} ${args.join(" ")}`;

// a cli that can't be spawned at all (corrupt, vanished since planning) is a failed step, not a crash
function exitCodeOf(run: RunCommand, cli: string, args: string[]): number {
  try {
    return run(cli, args);
  } catch {
    return SPAWN_FAILED;
  }
}

// adding an already-added marketplace errors harmlessly; a failed removal only passes once the
// marketplace is verifiably gone
function marketplaceFailure(integration: PluginIntegration, step: string[], text: string): StepResult {
  if (step[2] === "add") return { status: "skipped", text: `${text} (failed — likely already added)` };
  if (!isMarketplaceRegistered(integration)) return { status: "skipped", text: `${text} (failed — already removed)` };
  return { status: "failed", text: `${text} (failed — still registered)` };
}

function applyPlugin(integration: PluginIntegration, steps: string[][], yes: boolean, run: RunCommand): StepResult[] {
  const { cli } = integration;
  const results: StepResult[] = [];
  for (const step of steps) {
    const args = pluginStepArgs(cli, step, yes);
    const text = renderCommand(cli, args);
    if (exitCodeOf(run, cli, args) === 0) { results.push({ status: "ok", text }); continue; }
    if (isMarketplaceStep(step)) {
      const result = marketplaceFailure(integration, step, text);
      results.push(result);
      if (result.status === "failed") break;
      continue;
    }
    results.push({ status: "failed", text: `${text} (failed)` });
    break;
  }
  return results;
}

function applyMcpConfig({ path, key, entry }: McpConfigIntegration, mode: SetupMode): StepResult[] {
  let action: ConfigAction;
  try {
    action = mode === "install" ? mergeMcpEntry(path, key, MCP_SERVER_NAME, entry) : removeMcpEntry(path, key, MCP_SERVER_NAME);
  } catch (err) {
    // unreadable/unwritable config fails this agent only; the rest still run
    return [{ status: "failed", text: `${path} (${err instanceof Error ? err.message : String(err)})` }];
  }
  if (action === "not-found") return [{ status: "skipped", text: `nothing to remove in ${path}` }];
  if (action !== "skipped") return [{ status: "ok", text: `${action} → ${path}` }];
  // failed, not skipped: the entry still points at the binary, so an uninstall must not proceed
  if (mode === "remove") return [{ status: "failed", text:`${path} is not plain JSON (has comments?) — remove the ${MCP_SERVER_NAME} entry by hand` }];
  return [{
    status: "skipped",
    text: `${path} is not plain JSON (has comments?) — add this by hand:`,
    detail: mcpEntrySnippet(key, MCP_SERVER_NAME, entry),
  }];
}

export function applyAgent(target: AgentTarget, mode: SetupMode, yes: boolean, run: RunCommand = runInherited): StepResult[] {
  const { integration } = target;
  if (integration.kind === "mcp-config") return applyMcpConfig(integration, mode);
  return applyPlugin(integration, mode === "install" ? integration.install : integration.remove, yes, run);
}
