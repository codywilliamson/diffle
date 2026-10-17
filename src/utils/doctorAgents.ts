// doctor's view of the non-claude agents: retired plugins or mcp configs the automatic first-run
// pass couldn't clear. claude code keeps its own plugin checks (claudePlugins.ts).

import { homedir } from "node:os";
import { serverCommand } from "../core/agentTargets";
import { configPath } from "../core/migration/agentPluginsConfigs";
import { defaultAgentPluginsDeps, findLegacyAgents, migrateFinding, type AgentFinding } from "../core/migration/agentPlugins";
import { PRODUCT } from "../core/product";
import type { Check } from "./claudePlugins";

const CLAUDE_ID = "claude";

export function findAgentIssues(): AgentFinding[] {
  const home = homedir();
  const agentEnv = { home, platform: process.platform, env: process.env, command: serverCommand(process.execPath, home) };
  return findLegacyAgents(agentEnv)
    .map((finding) => (finding.target.id === CLAUDE_ID ? { ...finding, steps: [] } : finding))
    .filter((finding) => finding.steps.length > 0 || finding.config !== "clean");
}

export function agentChecks(findings: AgentFinding[]): Check[] {
  return findings.map(({ target, steps, config }) => {
    const problems = [
      ...(steps.some((step) => step.kind === "remove") ? [`retired plugin still registered`] : []),
      ...(config === "legacy" ? [`${configPath(target)} still launches a retired server`] : []),
      ...(config === "unreadable" ? [`${configPath(target)} mentions a retired server but can't be edited automatically (comments?) — edit it by hand`] : []),
    ];
    return { level: "fail" as const, label: target.displayName, detail: problems.join("; ") || "retired plugin missing its replacement" };
  });
}

// what --fix will do; unreadable configs are excluded because only a hand edit clears them
export function agentPlanLines(findings: AgentFinding[]): string[] {
  return findings.flatMap(({ target, steps, config }) => {
    const { integration } = target;
    const cli = integration.kind === "plugin" ? integration.cli : "";
    return [
      ...steps.map((step) => `${cli} ${step.args.join(" ")}`),
      ...(config === "legacy" ? [`rewrite ${configPath(target)} to launch ${PRODUCT.name}`] : []),
    ];
  });
}

// repairs each agent independently (one agent's missing cli never blocks another) and returns
// what is still unfinished, re-checked from disk so a step that "succeeded" but changed nothing shows
export function repairAgents(findings: AgentFinding[]): string[] {
  const deps = { ...defaultAgentPluginsDeps(), log: (line: string) => console.log(line) };
  deps.stopServers();
  const leftovers: string[] = [];
  for (const finding of findings) {
    const outcome = migrateFinding(finding, deps);
    deps.log(outcome.line);
    leftovers.push(...outcome.left.map((item) => `${finding.target.displayName}: ${item}`));
  }
  const remaining = findAgentIssues().map(({ target }) => `${target.displayName}: still has a retired plugin or config`);
  return leftovers.length > 0 ? leftovers : remaining;
}
