#!/usr/bin/env -S bun --no-env-file
// nittle cli entry point: launch a browser review or run the local MCP server.

import { join } from "node:path";
import { helpFor, parseCliArgs } from "./utils/cli";
import { launchReview } from "./core/reviewLaunch";
import { currentVersion } from "./core/updateCheck";
import { runMcpServer } from "./mcp";
import { installationRoot } from "./utils/installRoot";
import { runCompletionHook } from "./core/completionHook";
import { runUpdate } from "./core/update";
import { launchUpdateNotice } from "./core/updateNotice";
import { runCleanupCommand, runSessionsCommand } from "./utils/sessionsCli";
import { runDoctorCommand } from "./utils/doctorCli";
import { runSetup } from "./utils/setupCli";
import { runLspCommand } from "./utils/lspCli";
import { runMcpListCommand, runMcpRestartCommand } from "./utils/mcpCli";
import { hasStaleLegacyPlugin, readClaudePluginState } from "./utils/claudePlugins";
import { classifySessions } from "./core/sessions";
import { readReviewRecord } from "./core/reviewRecords";
import { PRODUCT } from "./core/product";
import { LEGACY_MIGRATION_STEPS, runLegacyMigrations, shouldRunLegacyMigrations } from "./core/migration";
import { productEnv } from "./utils/env";
import { resolveLicenseText } from "./core/standalone";
import { EXIT_INTERRUPTED } from "./core/waitExit";
import { onShutdownSignals } from "./core/shutdownSignals";
import { resumeHint, runWait, stoppedExit } from "./utils/waitCli";
import { renderCompletion } from "./utils/completion";
import { COMPLETION_SHELLS } from "./utils/cliVocabulary";

// ansi styling, skipped when stdout isn't a terminal.
const tty = process.stdout.isTTY === true;
const paint = (code: string) => (s: string) => (tty ? `\x1b[${code}m${s}\x1b[0m` : s);
const accent = paint(PRODUCT.accent);
const bold = paint("1");
const dim = paint("2");
const tag = `[${PRODUCT.name}]`;

// one cheap read of claude's plugin registry per launch; any problem stays silent.
function staleLegacyPlugin(): boolean {
  try { return hasStaleLegacyPlugin(readClaudePluginState()); } catch { return false; }
}

function fail(message: string): never {
  console.error(`${accent(tag)} ${message}`);
  process.exit(1);
}

export async function main(): Promise<void> {
  const cwd = process.cwd();
  const productRoot = installationRoot(join(import.meta.dir, ".."));

  let opts;
  try {
    opts = parseCliArgs(process.argv.slice(2));
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err));
  }
  // evaluated from shell profiles on every startup: no migration side effects, nothing but the script or its help.
  if (opts.command === "completion") {
    if (opts.help) return console.log(helpFor(opts.command, opts.spec));
    if (!opts.shell) fail(`completion needs --shell ${COMPLETION_SHELLS.join("|")}`);
    return void process.stdout.write(renderCompletion(opts.shell));
  }
  const steps = shouldRunLegacyMigrations() ? LEGACY_MIGRATION_STEPS : [];
  for (const result of await runLegacyMigrations(steps)) {
    if (!result.ok) console.error(`migration ${result.name} failed: ${result.summary}`);
  }
  if (opts.help) return console.log(helpFor(opts.command, opts.spec));
  if (opts.version) return console.log(`${PRODUCT.name} v${currentVersion(productRoot)}\n${PRODUCT.lineage}`);
  if (opts.license) return console.log(resolveLicenseText(productRoot).trimEnd());
  if (opts.mcpAction === "serve") return runMcpServer(cwd);
  if (opts.mcpAction === "list") return runMcpListCommand();
  if (opts.mcpAction === "restart") return runMcpRestartCommand({ yes: opts.yes });
  if (opts.command === "hook") {
    if (!opts.agent) fail("hook stop requires --agent codex or claude-code");
    return runCompletionHook(opts.agent, productRoot);
  }
  if (opts.command === "sessions") return runSessionsCommand();
  if (opts.command === "cleanup") return runCleanupCommand({ yes: opts.yes, all: opts.all });
  if (opts.command === "doctor") return runDoctorCommand({ fix: opts.fix, yes: opts.yes }, productRoot);
  if (opts.command === "lsp") return runLspCommand(opts.lspAction, opts.lspTarget);
  if (opts.command === "setup") {
    const code = await runSetup({ remove: opts.remove, agents: opts.agents, yes: opts.yes });
    if (code !== 0) process.exit(code);
    return;
  }
  if (opts.command === "update") {
    try { return await runUpdate(productRoot, opts.check); }
    catch (err) { fail(err instanceof Error ? err.message : String(err)); }
  }

  const host = productEnv("SESSION_HOST") === "hook" ? "hook" : "cli";
  let launch;
  try {
    launch = launchReview({
      cwd, productRoot, spec: opts.spec, scope: opts.scope, reviewId: opts.reviewId,
      policy: "handoff", port: opts.port, open: opts.open, lsp: opts.lsp, lspOverrides: opts.lspOverrides, host,
    });
  } catch (err) {
    fail(err instanceof Error ? err.message : `port ${opts.port} is already in use`);
  }

  // keep the session registry tidy on ctrl+c / kill instead of leaving a dead-pid entry behind.
  let stopped = false;
  const stopSelf = () => { if (stopped) return; stopped = true; launch.stop(); };
  // while waiting, a quiet exit 0 would look like an approval, so interrupts get their own code.
  const interruptCode = opts.wait ? EXIT_INTERRUPTED : 0;
  const onInterrupt = () => {
    stopSelf();
    if (opts.wait) console.error(`${tag} ${resumeHint(launch.review.id)}`);
    process.exit(interruptCode);
  };
  if (opts.wait) launch.ctx.exitCodeOnStop = () => stoppedExit(launch.review.id, (line) => console.error(`${tag} ${line}`));
  onShutdownSignals(onInterrupt);
  process.on("exit", stopSelf);

  // with --wait stdout carries only the result, so every status line goes to stderr.
  const say = opts.wait ? console.error : console.log;
  const files = launch.diff.files.length;
  const changed = launch.diff.meta?.mode === "browse" ? "" : " changed";
  say(`${accent(tag)} ${dim(`v${currentVersion(productRoot)}`)} — reviewing ${bold(launch.diff.ref)} (${files} file${files === 1 ? "" : "s"}${changed})`);
  say(`  ${bold(launch.url)}  ${dim("(ctrl+c to stop)")}`);
  void launchUpdateNotice(productRoot).then((notice) => notice && say(`${accent(tag)} ${dim(notice)}`));

  if (staleLegacyPlugin()) {
    say(`${accent(tag)} ${dim(`stale ${PRODUCT.legacyPlugin.name} plugin detected — run ${PRODUCT.name} doctor`)}`);
  }

  const { stale, live } = await classifySessions();
  const finished = live.filter((entry) => entry.reviewId !== launch.review.id).filter((entry) => {
    const status = readReviewRecord(entry.reviewId)?.status;
    return status === "approved" || status === "cancelled";
  });
  const staleCount = stale.length + finished.length;
  if (staleCount > 0) {
    say(`${accent(tag)} ${dim(`${staleCount} stale session${staleCount === 1 ? "" : "s"} — run ${PRODUCT.name} cleanup`)}`);
  }

  if (opts.wait) {
    const code = await runWait(launch, opts.json, (line) => console.error(`${accent(tag)} ${line}`));
    stopSelf();
    process.exit(code);
  }
}

// run when invoked directly (`bun src/index.ts` or the compiled binary's entry does it explicitly);
// the standalone build imports main after injecting its embedded assets + version first.
if (import.meta.main) await main();
