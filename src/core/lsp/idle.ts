// servers load the project right after the first didOpen, and answer in the meantime from a
// half-built program (typescript-language-server resolves an import to the import itself).
// this waits for that work to finish: a short grace for progress to start, then until it ends.

import type { LspBridge } from "./bridge";

export const PROGRESS_START_GRACE_MS = 2000;
export const PROGRESS_MAX_WAIT_MS = 20_000; // a slow solution load must not hang a request forever
const POLL_MS = 20;

export async function waitForProgressIdle(bridge: LspBridge, graceMs = PROGRESS_START_GRACE_MS, maxMs = PROGRESS_MAX_WAIT_MS): Promise<void> {
  const startedAt = Date.now();
  const startsBefore = bridge.progressStarts;
  while (Date.now() - startedAt < maxMs) {
    const sawProgress = bridge.progressStarts > startsBefore;
    if (bridge.activeProgress === 0 && (sawProgress || Date.now() - startedAt >= graceMs)) return;
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
}
