// builds Bun.serve and routes requests to handlers by method + pathname.

import type { Server } from "bun";
import type { ServerContext } from "./handlers";
import { maybeCompress } from "./compress";
import {
  handleGetDiff,
  handleGetComments,
  handlePostComments,
  handlePostViewed,
  handleGetCompile,
  handleGetUpdate,
} from "./handlers";
import { handleGetFile, handleGetRaw, serveStatic, notFound } from "./fileHandlers";
import { handleGetState, handlePostState } from "./stateHandlers";
import { handleGetLegacyReview, handleGetReview, handleLegacyReview, handleReviewOutcome, handleReviewReply, handleReviewStatus } from "./reviewHandlers";
import { handleSessionStop } from "./sessionHandlers";
import { apiError } from "./respond";

export type { ServerContext } from "./handlers";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const HTTP_DEFAULT_PORT = 80;

function hasAllowedOrigin(req: Request, serverPort: number): boolean {
  const origin = req.headers.get("origin");
  if (origin === null) return true;
  const url = new URL(req.url);
  return url.protocol === "http:"
    && LOOPBACK_HOSTS.has(url.hostname)
    && Number(url.port || HTTP_DEFAULT_PORT) === serverPort
    && origin === url.origin;
}

function route(ctx: ServerContext, req: Request, serverPort: number): Response | Promise<Response> {
  const { pathname } = new URL(req.url);
  const { method } = req;

  if (method === "GET") {
    if (pathname === "/api/diff") return handleGetDiff(ctx);
    if (pathname === "/api/comments") return handleGetComments(ctx);
    if (pathname === "/api/compile") return handleGetCompile(ctx, new URL(req.url));
    if (pathname === "/api/update") return handleGetUpdate(ctx);
    if (pathname === "/api/state") return handleGetState();
    if (pathname === "/api/file") return handleGetFile(ctx, new URL(req.url));
    if (pathname === "/api/raw") return handleGetRaw(ctx, new URL(req.url));
    if (pathname === "/api/review") return handleGetReview(new URL(req.url), ctx.reviewId);
    if (pathname === "/api/review/legacy") return handleGetLegacyReview(ctx.cwd);
    if (!pathname.startsWith("/api/")) return serveStatic(ctx.assets, pathname);
  }

  if (method === "POST") {
    if (!hasAllowedOrigin(req, serverPort)) return apiError("origin mismatch", 403);

    if (pathname === "/api/comments") return handlePostComments(ctx, req);
    if (pathname === "/api/viewed") return handlePostViewed(ctx, req);
    if (pathname === "/api/state") return handlePostState(req);
    if (pathname === "/api/review/outcome") return handleReviewOutcome(req);
    if (pathname === "/api/review/reply") return handleReviewReply(req);
    if (pathname === "/api/review/status") return handleReviewStatus(req);
    if (pathname === "/api/review/legacy") return handleLegacyReview(req, ctx.cwd);
    if (pathname === "/api/session/stop") return handleSessionStop(ctx, req);
  }

  return notFound();
}

export function createServer(ctx: ServerContext, port = 0): Server<undefined> {
  const server: Server<undefined> = Bun.serve({
    port,
    fetch: async (req) => maybeCompress(req, await route(ctx, req, server.port ?? port)),
  });
  return server;
}
