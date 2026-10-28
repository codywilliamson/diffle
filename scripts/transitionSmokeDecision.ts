#!/usr/bin/env bun
// upgrade-smoke.yml calls this so the workflow and the release rule share one source
// (src/core/transitionAssets.ts). usage: bun scripts/transitionSmokeDecision.ts <true|false>
// where the argument says whether the latest release carries the diffle-named assets.
// prints run|skip and exits 0, or prints an error and exits 1 for fail.

import { liveSmokeDecision, TRANSITION_ASSETS_UNTIL } from "../src/core/transitionAssets";

const decision = liveSmokeDecision(process.argv[2] === "true", new Date());
if (decision === "fail") {
  console.error(`::error::latest release has no diffle-named assets but the transition window is open until ${TRANSITION_ASSETS_UNTIL}; 0.28.x updaters are stranded. upload diffle-<os>-<arch> copies and a checksums.txt that lists them`);
  process.exit(1);
}
console.log(decision);
