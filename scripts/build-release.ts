#!/usr/bin/env bun
// cross-compiles the standalone binary for every release target and writes a sha-256 manifest.
// run without args for all targets, or pass a subset (e.g. `bun scripts/build-release.ts linux-x64`).
// CI runs one target per job and uploads dist/release/* into the draft GitHub Release.
// until the transition cutoff date (core/transitionAssets.ts) every nittle binary
// is also published as a byte-identical diffle-named copy, for 0.28.x updaters.

import { createHash } from "node:crypto";
import { appendFileSync, copyFileSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PRODUCT } from "../src/core/product";
import { carriesTransitionAssets, TRANSITION_ASSETS_UNTIL, transitionAssetName } from "../src/core/transitionAssets";
import { assetName } from "../src/core/updateTarget";
import { COMPILE_FLAGS } from "./compileFlags";
import { generateStandaloneEntry, WORKER_ENTRY_FILES } from "./generateStandaloneEntry";

const BUN_TARGET: Record<string, string> = {
  "linux-x64": "bun-linux-x64",
  "linux-arm64": "bun-linux-arm64",
  "darwin-x64": "bun-darwin-x64",
  "darwin-arm64": "bun-darwin-arm64",
  "windows-x64": "bun-windows-x64",
  "windows-arm64": "bun-windows-arm64",
};
const ALL = Object.keys(BUN_TARGET);

const root = join(import.meta.dir, "..");
const outDir = join(root, "dist", "release");
const requested = process.argv.slice(2);
const targets = requested.length ? requested : ALL;
for (const t of targets) if (!BUN_TARGET[t]) throw new Error(`unknown target: ${t} (of ${ALL.join(", ")})`);

const { entryFile, version } = generateStandaloneEntry(root);
mkdirSync(outDir, { recursive: true });

const withTransition = carriesTransitionAssets(version, new Date());
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `transition=${withTransition}\n`);
console.log(withTransition
  ? `release v${version} carries the ${PRODUCT.legacyName}-named transition assets (window open until ${TRANSITION_ASSETS_UNTIL})`
  : `release v${version} is past the transition cutoff ${TRANSITION_ASSETS_UNTIL}: no ${PRODUCT.legacyName} assets`);

const checksums: string[] = [];
const addChecksum = (name: string) => {
  const bytes = readFileSync(join(outDir, name));
  checksums.push(`${createHash("sha256").update(bytes).digest("hex")}  ${name}`);
  console.log(`built ${name} (${(statSync(join(outDir, name)).size / 1e6).toFixed(1)} MB)`);
};
for (const target of targets) {
  const name = assetName(target); // Bun appends .exe for windows targets, matching this name
  const outfile = join(outDir, `${PRODUCT.name}-${target}`);
  const r = Bun.spawnSync(["bun", "build", entryFile, ...WORKER_ENTRY_FILES, ...COMPILE_FLAGS, `--target=${BUN_TARGET[target]}`, "--outfile", outfile], { cwd: root, stdout: "inherit", stderr: "inherit" });
  if (r.exitCode !== 0) throw new Error(`compile failed for ${target}`);
  addChecksum(name);
  if (!withTransition) continue;
  const legacy = transitionAssetName(name);
  copyFileSync(join(outDir, name), join(outDir, legacy));
  addChecksum(legacy);
}
writeFileSync(join(outDir, "checksums.txt"), `${checksums.join("\n")}\n`);
console.log(`release v${version}: ${targets.length} target(s) → ${outDir}`);
