#!/usr/bin/env bun
// diffle cli entry point: launch a browser review or run the local MCP server.

import { join } from "node:path";
import { parseCliArgs, USAGE } from "./utils/cli";
import { launchReview } from "./core/reviewLaunch";
import { currentVersion } from "./core/updateCheck";
import { runMcpServer } from "./mcp";
import { installationRoot } from "./utils/installRoot";
import { runCompletionHook } from "./core/completionHook";
import { runUpdate } from "./core/update";
import { launchUpdateNotice } from "./core/updateNotice";
import { runCleanupCommand, runSessionsCommand } from "./utils/sessionsCli";
import { runDoctorCommand } from "./utils/doctorCli";
import { runMcpListCommand, runMcpRestartCommand } from "./utils/mcpCli";
import { hasStaleLegacyPlugin, readClaudePluginState } from "./utils/claudePlugins";
import { classifySessions } from "./core/sessions";
import { readReviewRecord } from "./core/reviewRecords";
import { PRODUCT } from "./core/product";
import { productEnv } from "./utils/env";
import { resolveLicenseText } from "./core/standalone";

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
  const loupeRoot = installationRoot(join(import.meta.dir, ".."));

  let opts;
  try {
    opts = parseCliArgs(process.argv.slice(2));
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err));
  }
  if (opts.help) return console.log(USAGE);
  if (opts.version) return console.log(`${PRODUCT.name} v${currentVersion(loupeRoot)}`);
  if (opts.license) return console.log(resolveLicenseText(loupeRoot).trimEnd());
  if (opts.mcpAction === "serve") return runMcpServer(cwd);
  if (opts.mcpAction === "list") return runMcpListCommand();
  if (opts.mcpAction === "restart") return runMcpRestartCommand({ yes: opts.yes });
  if (opts.command === "hook") {
    if (!opts.agent) fail("hook stop requires --agent codex or claude-code");
    return runCompletionHook(opts.agent, loupeRoot);
  }
  if (opts.command === "sessions") return runSessionsCommand();
  if (opts.command === "cleanup") return runCleanupCommand({ yes: opts.yes, all: opts.all });
  if (opts.command === "doctor") return runDoctorCommand({ fix: opts.fix, yes: opts.yes }, loupeRoot);
  if (opts.command === "update") {
    try { return await runUpdate(loupeRoot, opts.check); }
    catch (err) { fail(err instanceof Error ? err.message : String(err)); }
  }

  const host = productEnv("SESSION_HOST") === "hook" ? "hook" : "cli";
  let launch;
  try {
    launch = launchReview({
      cwd, loupeRoot, spec: opts.spec, scope: opts.scope, reviewId: opts.reviewId,
      policy: "handoff", port: opts.port, open: opts.open, host,
    });
  } catch (err) {
    fail(err instanceof Error ? err.message : `port ${opts.port} is already in use`);
  }

  // keep the session registry tidy on ctrl+c / kill instead of leaving a dead-pid entry behind.
  let stopped = false;
  const stopSelf = () => { if (stopped) return; stopped = true; launch.stop(); };
  process.on("SIGINT", () => { stopSelf(); process.exit(0); });
  process.on("SIGTERM", () => { stopSelf(); process.exit(0); });
  process.on("exit", stopSelf);

  const files = launch.diff.files.length;
  const changed = launch.diff.meta?.mode === "browse" ? "" : " changed";
  console.log(`${accent(tag)} ${dim(`v${currentVersion(loupeRoot)}`)} — reviewing ${bold(launch.diff.ref)} (${files} file${files === 1 ? "" : "s"}${changed})`);
  console.log(`  ${bold(launch.url)}  ${dim("(ctrl+c to stop)")}`);
  void launchUpdateNotice(loupeRoot).then((notice) => notice && console.log(`${accent(tag)} ${dim(notice)}`));

  if (staleLegacyPlugin()) {
    console.log(`${accent(tag)} ${dim(`stale ${PRODUCT.legacyPlugin.name} plugin detected — run ${PRODUCT.name} doctor`)}`);
  }

  const { stale, live } = await classifySessions();
  const finished = live.filter((entry) => entry.reviewId !== launch.review.id).filter((entry) => {
    const status = readReviewRecord(entry.reviewId)?.status;
    return status === "approved" || status === "cancelled";
  });
  const staleCount = stale.length + finished.length;
  if (staleCount > 0) {
    console.log(`${accent(tag)} ${dim(`${staleCount} stale session${staleCount === 1 ? "" : "s"} — run ${PRODUCT.name} cleanup`)}`);
  }
}

// run when invoked directly (`bun src/index.ts` or the compiled binary's entry does it explicitly);
// the standalone build imports main after injecting its embedded assets + version first.
if (import.meta.main) await main();
