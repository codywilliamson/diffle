#!/usr/bin/env bun
// upgrade-smoke.yml calls this so the workflow and the release rule share one source
// (src/core/transitionAssets.ts). usage: bun scripts/transitionSmokeDecision.ts <true|false>
// where the argument says whether the latest release carries the legacy-named assets.
// prints run|skip and exits 0, or prints an error and exits 1 for fail.

import { PRODUCT } from "../src/core/product";
import { liveSmokeDecision, TRANSITION_ASSETS_UNTIL, transitionAssetName } from "../src/core/transitionAssets";

const decision = liveSmokeDecision(process.argv[2] === "true", new Date());
if (decision === "fail") {
  const example = transitionAssetName(`${PRODUCT.name}-<os>-<arch>`);
  console.error(`::error::latest release has no ${PRODUCT.legacyName}-named assets but the transition window is open until ${TRANSITION_ASSETS_UNTIL}; 0.28.x updaters are stranded. upload ${example} copies and a checksums.txt that lists them`);
  process.exit(1);
}
console.log(decision);
