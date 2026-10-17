import type { Server } from "bun";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import type { DiffResult, ReviewOrigin, ReviewPolicy, ReviewRecord } from "../types";
import { openBrowser } from "../utils/browser";
import { createServer, type ServerContext } from "../server/router";
import { resolveClientAssets } from "./standalone";
import { createReviewRecord, readReviewRecord } from "./reviewRecords";
import { loadReviewTarget } from "./reviewTarget";
import { createLspPool } from "./lsp/launchPool";
import type { LspPool } from "./lsp/pool";
import { registerSession, unregisterSession, type SessionHost } from "./sessions";

export interface ReviewLaunchInput {
  cwd: string;
  productRoot: string;
  spec?: string;
  scope?: string;
  reviewId?: string;
  policy?: ReviewPolicy;
  origin?: ReviewOrigin;
  port?: number;
  open?: boolean;
  requireChanges?: boolean;
  lsp?: boolean; // false (--no-lsp) never starts a language server
  lspPool?: LspPool; // replaces the default pool; tests inject a fake-backed one
  host: SessionHost;
}

export interface ReviewLaunch {
  review: ReviewRecord;
  url: string;
  server: Server<undefined>;
  diff: DiffResult;
  stop: () => void; // stops the server and removes its session registry entry
}

export function launchReview(input: ReviewLaunchInput): ReviewLaunch {
  const existing = input.reviewId ? readReviewRecord(input.reviewId) : null;
  if (input.reviewId && !existing) throw new Error("review record not found");
  const cwd = resolve(existing?.target.cwd ?? input.cwd);
  const spec = existing?.target.spec ?? input.spec;
  const loaded = loadReviewTarget(cwd, spec, input.scope, false);
  if (!existing && input.requireChanges && loaded.diff.files.length === 0) {
    throw new Error(`No changes found for "${loaded.diff.ref}". Use ref "working" for current tracked and untracked changes, or verify the requested comparison.`);
  }
  const storedSpec = loaded.pinnedSpec ?? spec;
  const review = existing ?? createReviewRecord({
    target: { cwd, ref: loaded.diff.ref, ...(storedSpec ? { spec: storedSpec } : {}), ...(loaded.meta ? { meta: loaded.meta } : {}) },
    policy: input.policy ?? "handoff", ...(input.origin ? { origin: input.origin } : {}),
  });
  const assets = resolveClientAssets(input.productRoot);
  const sessionId = randomUUID();
  const lsp = input.lspPool ?? createLspPool(cwd, input.lsp !== false);
  const ctx: ServerContext = { ...loaded, cwd, assets, productRoot: input.productRoot, served: false, reviewId: review.id, host: input.host, sessionId, lsp };
  const server = createServer(ctx, input.port ?? 0);
  const port = server.port ?? 0;
  const origin = `http://localhost:${port}`;
  const url = `${origin}/?review=${encodeURIComponent(review.id)}`;
  // best-effort synchronous full stop for callers that already hold this launch directly
  // (ctrl+c, MCP's stopAll, tests) — always tears down and unregisters, no gating.
  const stop = (): void => { server.stop(true); unregisterSession(sessionId); lsp.killAll(); };
  try {
    registerSession({ sessionId, reviewId: review.id, pid: process.pid, port, url: origin, cwd, host: input.host, startedAt: new Date().toISOString() });
    let stoppedOnce = false;
    // /api/session/stop calls this from a deferred block (see sessionHandlers): idempotent, and
    // it only unregisters once the server has actually stopped, so a throwing stop leaves the
    // entry discoverable for `nittle cleanup` to retry.
    ctx.shutdown = async () => {
      if (stoppedOnce) return;
      stoppedOnce = true;
      await server.stop(true);
      unregisterSession(sessionId);
      await lsp.shutdown(); // graceful; the sync stop() above still kills anything left on process exit
    };
    if (input.open !== false) openBrowser(url);
  } catch (error) {
    stop();
    throw error;
  }
  return { review, url, server, diff: loaded.diff, stop };
}
