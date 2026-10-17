#!/usr/bin/env bun
// upgrade smoke (decision D23): a real diffle 0.28.1 install updates to nittle, and a fresh shell finds
// nittle, every review record and pref, and nothing named diffle on disk, PATH or in agent configs.
//
//   bun scripts/upgrade-smoke.ts --binary dist/nittle[.exe]    simulated: do what the 0.28.1 updater does
//   bun scripts/upgrade-smoke.ts --mode live                   run the real `diffle update` against GitHub
//
// simulated mode needs a host build (`bun run build:binary`) and works before any release carries the
// transition asset. live mode only passes once a published release has the diffle-<os>-<arch> asset.
// everything runs inside a temp home (upgrade-smoke/sandbox.ts); --registry (disposable ci windows
// runners only) uses the real user PATH instead of the scope-file stand-in. --keep keeps the temp root.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { PRODUCT } from "../src/core/product";
import { runChecks } from "./upgrade-smoke/checks";
import { openFreshShell } from "./upgrade-smoke/freshShell";
import { installOldDiffle, OLD_VERSION } from "./upgrade-smoke/installOld";
import { createSandbox, EXE } from "./upgrade-smoke/sandbox";
import { seedDiffleHome, seedShellProfile } from "./upgrade-smoke/seed";
import { liveOldUpdater, printedNextStep, simulateOldUpdater } from "./upgrade-smoke/swap";

const root = join(import.meta.dir, "..");
const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const option = (name: string) => (flag(name) ? args[args.indexOf(`--${name}`) + 1] : undefined);
const mode = option("mode") ?? "simulated";
if (mode !== "simulated" && mode !== "live") throw new Error(`--mode is simulated or live, got ${mode}`);
const binary = resolve(option("binary") ?? join(root, "dist", `${PRODUCT.name}${EXE}`));
if (mode === "simulated" && !existsSync(binary)) throw new Error(`build the transition asset first (bun run build:binary): ${binary} not found`);

// the real home must come out exactly as it went in
function realHomeFingerprint(): string {
  return [PRODUCT.legacyDataDir, PRODUCT.dataDir, PRODUCT.loupeDataDir].map((name) => {
    const dir = join(homedir(), name);
    return existsSync(dir) ? `${name}:${statSync(dir).mtimeMs}:${readdirSync(dir).join(",")}` : `${name}:absent`;
  }).join("|");
}

const before = realHomeFingerprint();
const box = createSandbox(flag("registry"));
console.log(`sandbox: ${box.root}\nmode: ${mode}${box.scopeFile ? " (user PATH stand-in: scope file)" : ""}`);
const version = (JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { version: string }).version;
let failed = 0;

try {
  const diffleBinary = join(box.home, PRODUCT.legacyDataDir, "bin", `${PRODUCT.legacyName}${EXE}`);
  seedShellProfile(box.home);
  const seeded = seedDiffleHome(box.home, box.env().CODEX_HOME!, diffleBinary);
  console.log(`\n== install diffle ${OLD_VERSION} with its own installer`);
  const old = await installOldDiffle(box, root);

  console.log(`\n== update (${mode})`);
  if (mode === "simulated") simulateOldUpdater(old.binary, binary, box.root);
  else if (liveOldUpdater(box, old.binary).code !== 0) throw new Error("`diffle update` failed");
  const nextStep = printedNextStep(box, old.binary);
  if (nextStep.code !== 0) throw new Error(`the printed next step \`diffle --version\` exited ${nextStep.code}`);

  // a new shell; its `nittle --version` is also the next run that retries a deferred (windows) delete
  console.log("\n== fresh shell");
  const shell = openFreshShell(box);

  console.log("\n== checks");
  const results = runChecks({ box, seeded, shell, version, noticeOutput: nextStep.stdout + nextStep.stderr });
  for (const result of results) {
    console.log(`${result.ok ? "PASS" : "FAIL"}  ${result.name}${result.detail ? `\n      ${result.detail.replaceAll("\n", "\n      ")}` : ""}`);
  }
  failed = results.filter((result) => !result.ok).length;
  console.log(failed === 0 ? `\nupgrade smoke passed (${results.length} checks)` : `\nupgrade smoke FAILED (${failed} of ${results.length} checks)`);
} finally {
  const after = realHomeFingerprint();
  if (after !== before) {
    console.error(`REAL HOME CHANGED\n  before: ${before}\n  after:  ${after}`);
    failed ||= 1;
  } else if (!flag("registry")) console.log("real home untouched");
  if (flag("keep")) console.log(`kept ${box.root}`);
  else box.cleanup();
}
process.exit(failed === 0 ? 0 : 1);
