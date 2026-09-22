// `diffle doctor` — report (and optionally repair) a stale legacy Claude Code plugin install.
// repairs go through the `claude` cli; claude's own json registry is never edited here.

import { basename } from "node:path";
import { PRODUCT } from "../core/product";
import { homeDataDir } from "../core/dataDir";
import { confirmProceed } from "./confirm";
import { diagnoseClaudePlugins, readClaudePluginState, type CheckLevel, type RepairStep } from "./claudePlugins";

export interface DoctorOptions { fix: boolean; yes: boolean; }

const CLAUDE_CLI = "claude";
const BADGE: Record<CheckLevel, string> = { ok: "OK  ", warn: "WARN", fail: "FAIL", info: "INFO" };
const RELOAD_HINT = `start a new Claude Code session (or run /reload-plugins) so the ${PRODUCT.name} MCP server replaces ${PRODUCT.legacyName}`;

const render = (step: RepairStep, args = step.args) => `${CLAUDE_CLI} ${args.join(" ")}`;

// `plugin install` prompts before trusting a marketplace-declared command; --yes accepts it.
const stepArgs = (step: RepairStep, yes: boolean) =>
  yes && step.args[1] === "install" ? [...step.args, "--yes"] : step.args;

function printPlan(plan: RepairStep[], heading: string, yes = false): void {
  console.log(`\n${heading}`);
  for (const step of plan) console.log(`  ${render(step, stepArgs(step, yes))}`);
}

// runs the plan through the `claude` cli, sequentially, stopping on the first real failure.
function applyPlan(plan: RepairStep[], claude: string, yes: boolean): void {
  for (const step of plan) {
    const args = stepArgs(step, yes);
    console.log(`\n${render(step, args)}`);
    const result = Bun.spawnSync({ cmd: [claude, ...args], stdio: ["inherit", "inherit", "pipe"] });
    const stderr = result.stderr?.toString() ?? "";
    if (stderr) process.stderr.write(stderr);
    if (result.exitCode === 0) continue;
    // an older claude code may not have the subcommand — leave it to the user and carry on.
    if (/unknown (command|option)/i.test(stderr)) {
      console.log(`  unsupported by this ${CLAUDE_CLI} version — run it yourself: ${render(step, args)}`);
      continue;
    }
    console.error(`\nstep failed (exit ${result.exitCode}): ${render(step, args)}`);
    process.exit(1);
  }
  console.log(`\ndone — ${RELOAD_HINT}`);
}

export async function runDoctorCommand(opts: DoctorOptions): Promise<void> {
  const state = readClaudePluginState();
  const usingLegacyDataDir = basename(homeDataDir()) === PRODUCT.legacyDataDir;
  const { checks, plan, ok } = diagnoseClaudePlugins(
    state, Bun.which(PRODUCT.name) ?? undefined, Bun.which(PRODUCT.legacyName) ?? undefined, usingLegacyDataDir,
  );

  console.log(`${PRODUCT.name} doctor — Claude Code plugin health (${state.configDir})\n`);
  const width = Math.max(...checks.map((check) => check.label.length));
  for (const check of checks) console.log(`  ${BADGE[check.level]}  ${check.label.padEnd(width)}  ${check.detail}`);

  if (plan.length === 0) {
    console.log(`\nnothing to repair`);
    if (!ok) process.exit(1);
    return;
  }

  if (!opts.fix) {
    printPlan(plan, "To repair, run:");
    console.log(`\nor let ${PRODUCT.name} run them: ${PRODUCT.name} doctor --fix`);
    if (!ok) process.exit(1);
    return;
  }

  const claude = Bun.which(CLAUDE_CLI);
  if (!claude) {
    printPlan(plan, `\`${CLAUDE_CLI}\` is not on PATH — nothing was run. Run these yourself:`, opts.yes);
    process.exit(1);
  }

  printPlan(plan, "plan:", opts.yes);
  if (!(await confirmProceed(opts.yes))) return;
  applyPlan(plan, claude, opts.yes);
}
