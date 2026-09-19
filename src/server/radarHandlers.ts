// Radar API: analyze the server's current diff and reconstruct exact outbound packets on demand.

import type { ServerContext } from "./handlers";
import { analyzeRadar, radarPacket } from "../radar/analyze";
import { apiError, json } from "./respond";
import { collectDiff } from "../utils/git";
import { parseDiff } from "../core/diffParser";
import type { DiffResult } from "../types";
import { providerFromEnv, providerRequestBody } from "../radar/provider";

const running = new WeakMap<ServerContext, Promise<Awaited<ReturnType<typeof analyzeRadar>>>>();
const contexts = new WeakMap<ServerContext, { diff: DiffResult; context: DiffResult }>();

function radarContext(ctx: ServerContext): DiffResult {
  if (ctx.mode === "browse") return ctx.diff;
  const cached = contexts.get(ctx);
  if (cached?.diff === ctx.diff) return cached.context;
  try {
    const args = [...ctx.diffArgs, "--function-context", "--no-ext-diff", "--no-textconv"];
    const raw = collectDiff(args, ctx.cwd, ctx.includeUntracked, false);
    const context = { ...parseDiff(raw, ctx.diff.ref), meta: ctx.meta };
    contexts.set(ctx, { diff: ctx.diff, context });
    return context;
  } catch {
    return ctx.diff;
  }
}

export async function handleGetRadar(ctx: ServerContext, _url: URL): Promise<Response> {
  return json(await analyzeRadar(ctx.diff, false, process.env, fetch, true, radarContext(ctx)));
}

export async function handlePostRadar(ctx: ServerContext, req: Request): Promise<Response> {
  const origin = req.headers.get("origin");
  if (origin !== null && origin !== new URL(req.url).origin) return apiError("origin mismatch", 403);
  let refresh = false;
  try { refresh = ((await req.json()) as { refresh?: unknown }).refresh === true; }
  catch { return apiError("invalid json body", 400); }
  let task = running.get(ctx);
  if (!task) {
    task = analyzeRadar(ctx.diff, refresh, process.env, fetch, false, radarContext(ctx));
    running.set(ctx, task);
    void task.finally(() => { if (running.get(ctx) === task) running.delete(ctx); });
  }
  return json(await task);
}

export function handleGetRadarPacket(ctx: ServerContext, url: URL): Response {
  const id = url.searchParams.get("id")?.trim();
  if (!id) return apiError("radar packet id is required", 400);
  try {
    const packet = radarPacket(ctx.diff, id, process.env, radarContext(ctx));
    const config = providerFromEnv();
    return packet && config ? json(providerRequestBody(config, packet)) : apiError("radar packet not found", 404);
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "radar packet unavailable", 400);
  }
}
