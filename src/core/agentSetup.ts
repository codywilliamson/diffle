// applies (or removes) one agent's diffle integration and reports what happened per step.

import { mcpEntrySnippet, mergeMcpEntry, removeMcpEntry, type ConfigAction } from "./mcpConfigFile";
import { MCP_SERVER_NAME, type AgentTarget, type McpConfigIntegration, type PluginCli } from "./agentTargets";

export type SetupMode = "install" | "remove";
export type StepStatus = "ok" | "skipped" | "failed";
export interface StepResult { status: StepStatus; text: string; detail?: string; }
export type RunCommand = (cli: string, args: string[]) => number;

export const runInherited: RunCommand = (cli, args) =>
  Bun.spawnSync({ cmd: [cli, ...args], stdio: ["inherit", "inherit", "inherit"] }).exitCode;

const isMarketplaceStep = (args: string[]) => args[1] === "marketplace";

// claude prompts before trusting a marketplace-declared command; --yes accepts it (codex has no such flag)
export function pluginStepArgs(cli: PluginCli, args: string[], yes: boolean): string[] {
  return yes && cli === "claude" && args[1] === "install" ? [...args, "--yes"] : args;
}

export const renderCommand = (cli: string, args: string[]) => `${cli} ${args.join(" ")}`;

function applyPlugin(cli: PluginCli, steps: string[][], yes: boolean, run: RunCommand): StepResult[] {
  const results: StepResult[] = [];
  for (const step of steps) {
    const args = pluginStepArgs(cli, step, yes);
    const text = renderCommand(cli, args);
    if (run(cli, args) === 0) { results.push({ status: "ok", text }); continue; }
    // adding an already-added (or removing a missing) marketplace errors — harmless, carry on
    if (isMarketplaceStep(step)) { results.push({ status: "skipped", text: `${text} (failed — likely already ${step[2] === "add" ? "added" : "removed"})` }); continue; }
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
  if (mode === "remove") return [{ status: "skipped", text: `${path} is not plain JSON (has comments?) — remove the ${MCP_SERVER_NAME} entry by hand` }];
  return [{
    status: "skipped",
    text: `${path} is not plain JSON (has comments?) — add this by hand:`,
    detail: mcpEntrySnippet(key, MCP_SERVER_NAME, entry),
  }];
}

export function applyAgent(target: AgentTarget, mode: SetupMode, yes: boolean, run: RunCommand = runInherited): StepResult[] {
  const { integration } = target;
  if (integration.kind === "mcp-config") return applyMcpConfig(integration, mode);
  return applyPlugin(integration.cli, mode === "install" ? integration.install : integration.remove, yes, run);
}
