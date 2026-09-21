// POST /api/session/stop — validated against the server's own origin and this server's session id,
// then the actual teardown is deferred a beat so this handler's own 200 response has time to flush
// before the socket goes away (a synchronous `server.stop`/`process.exit` here would race the
// in-flight response and reset it). cli/hook hosts are the whole process, so they also exit; an
// mcp-hosted server just tears down its Bun.serve, since the agent's process keeps running.

import type { ServerContext } from "./handlers";
import { PRODUCT } from "../core/product";
import { apiError, json } from "./respond";

const SHUTDOWN_DELAY_MS = 50;

export async function handleSessionStop(ctx: ServerContext, req: Request): Promise<Response> {
  // browser fetches send an Origin header; the CLI's own fetch (diffle cleanup) sends none.
  const requestOrigin = req.headers.get("origin");
  const selfOrigin = new URL(req.url).origin;
  if (requestOrigin !== null && requestOrigin !== selfOrigin) return apiError("origin mismatch", 403);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("invalid json body", 400);
  }
  const sessionId = (body as { sessionId?: unknown } | null)?.sessionId;
  if (typeof sessionId !== "string" || sessionId.length === 0) return apiError("sessionId is required", 400);
  if (sessionId !== ctx.sessionId) return apiError("sessionId mismatch", 403);

  setTimeout(async () => {
    try {
      await ctx.shutdown?.();
    } catch (error) {
      // stop failed partway — the registry entry is left in place so `diffle cleanup` can retry.
      console.error(`[${PRODUCT.name}] session stop failed: ${error instanceof Error ? error.message : String(error)}`);
      return;
    }
    if (ctx.host === "cli" || ctx.host === "hook") process.exit(0);
  }, SHUTDOWN_DELAY_MS);
  return json({ stopped: true });
}
