// which follow-up steps apply after `update` swapped the binary. pure — no io.

import { PRODUCT } from "./product";

export interface McpRestartOutcome {
  found: number; // this install's MCP servers still on the old version
  stopped: number;
  failed: number; // couldn't be stopped
  blockedByLive: number; // live review sessions that kept servers running
  checkFailed: boolean; // couldn't list servers at all
}

export const NO_MCP_ACTIVITY: McpRestartOutcome = { found: 0, stopped: 0, failed: 0, blockedByLive: 0, checkFailed: false };

const RESTART_COMMAND = `${PRODUCT.name} mcp restart`;

export function updateNextSteps(outcome: McpRestartOutcome): string[] {
  const steps = [`restart any open ${PRODUCT.name} review — it still runs the old version`];
  if (outcome.stopped > 0) steps.push("reconnect your agents to the new MCP server (Claude Code: /mcp → reconnect, or start a new session)");
  if (outcome.blockedByLive > 0) steps.push(`once your live reviews finish, run \`${RESTART_COMMAND}\` to reload the MCP server`);
  else if (outcome.failed > 0 || outcome.checkFailed) steps.push(`run \`${RESTART_COMMAND}\` to reload the MCP server, then reconnect your agents`);
  steps.push(`confirm the new version in a new shell: \`${PRODUCT.name} --version\``);
  return steps;
}

export function formatNextSteps(steps: string[]): string {
  return [`[${PRODUCT.name}] next steps:`, ...steps.map((step, i) => `  ${i + 1}. ${step}`)].join("\n");
}
