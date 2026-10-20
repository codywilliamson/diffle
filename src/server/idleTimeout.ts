// bun.serve cuts a connection after idleTimeout seconds with no bytes sent (default 10).
// a cold lsp request can wait for the server to initialize, then for the project load, then
// for the request itself. the pool restarts a crashed server once, so initialize can run twice.
// the budget is derived from those waits so it can't drift from them.

import { INITIALIZE_TIMEOUT_MS } from "../core/lsp/bridge";
import { PROGRESS_MAX_WAIT_MS } from "../core/lsp/idle";
import { MAX_RESTARTS } from "../core/lsp/pool";
import { REQUEST_TIMEOUT_MS } from "../core/lsp/jsonRpc";

export const BUN_MAX_IDLE_TIMEOUT_S = 255;
const IDLE_MARGIN_S = 10;
const MS_PER_SECOND = 1000;

export const SERVER_IDLE_TIMEOUT_S = Math.min(
  BUN_MAX_IDLE_TIMEOUT_S,
  Math.ceil(((1 + MAX_RESTARTS) * INITIALIZE_TIMEOUT_MS + PROGRESS_MAX_WAIT_MS + REQUEST_TIMEOUT_MS) / MS_PER_SECOND) + IDLE_MARGIN_S,
);
