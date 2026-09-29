// renders what `diffle setup` is about to do, per agent.

import { MCP_SERVER_NAME, type AgentTarget } from "../core/agentTargets";
import { pluginStepArgs, renderCommand, type SetupMode } from "../core/agentSetup";

export interface Style { bold: (s: string) => string; dim: (s: string) => string; }

export const cliMissing = (target: AgentTarget, which: (bin: string) => string | null): boolean =>
  target.integration.kind === "plugin" && !which(target.integration.cli);

export function planLines(target: AgentTarget, mode: SetupMode, yes: boolean, missing: boolean, style: Style): string[] {
  const lines = [style.bold(target.displayName)];
  const { integration } = target;
  if (integration.kind === "mcp-config") {
    lines.push(`  edit ${integration.path}  ${style.dim(`(${integration.key}.${MCP_SERVER_NAME})`)}`);
    return lines;
  }
  const commands = (mode === "install" ? integration.install : integration.remove)
    .map((args) => renderCommand(integration.cli, pluginStepArgs(integration.cli, args, yes)));
  if (missing) {
    lines.push(style.dim(`  – \`${integration.cli}\` not on PATH — install it or run these yourself:`));
    for (const command of commands) lines.push(`    ${command}`);
    return lines;
  }
  for (const command of commands) lines.push(`  run  ${command}`);
  return lines;
}
