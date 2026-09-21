// route handlers + the in-memory server context. all /api responses are json.

import type { DiffResult, DiffMeta, ReviewFile, Comment, CompilePromptResponse } from "../types";
import type { AssetSource } from "./assetSource";
import type { SessionHost } from "../core/sessions";
import { readReview, writeReview } from "../core/reviewStore";
import { excludeReviewFile } from "../core/reviewFilter";
import { compileReviewPrompt } from "../core/promptCompiler";
import { parseDiff } from "../core/diffParser";
import { checkForUpdate } from "../core/updateCheck";
import { scanProject } from "../core/projectScan";
import { collectDiff } from "../utils/git";
import { apiError, json } from "./respond";
import { readReviewRecord, updateReviewRecord } from "../core/reviewRecords";
import { mergeReviewerComments } from "../core/commentMerge";

export interface ServerContext {
  diff: DiffResult; // seeded at launch, re-run on each GET /api/diff for live review
  cwd: string; // directory where the .review file lives
  assets: AssetSource; // source for the built client (index.html + assets)
  loupeRoot: string; // loupe's own repo root, for the release-update check
  newRef: string | null; // ref for new-side file content; null = read working tree from disk
  diffArgs: string[]; // git args to re-run the diff on demand (refresh)
  includeUntracked: boolean; // working-tree mode also surfaces untracked files
  meta?: DiffMeta; // stable review context (repo + refs); reused across refreshes
  mode?: "diff" | "browse"; // browse re-scans the codebase on refresh instead of re-diffing
  scope?: string; // browse path scope, reused on refresh
  served: boolean; // true once the launch-computed diff has been handed to the client
  reviewId?: string; // durable Review Record selected by the MCP/CLI integration
  host: SessionHost; // which integration launched this server; read by /api/session/stop
  sessionId?: string; // this server's session registry id; set by reviewLaunch, checked by /api/session/stop
  shutdown?: () => void | Promise<void>; // set by reviewLaunch once the server exists; mutable by design
}

// stamps a legacy review and persists it outside the rendered diff.
function saveReview(ctx: ServerContext, review: ReviewFile): void {
  review.meta.updatedAt = new Date().toISOString();
  writeReview(ctx.cwd, review, true);
}

// load the current .review, or build a fresh empty one. used by both posts + compile.
function loadOrInit(ctx: ServerContext): ReviewFile {
  const existing = readReview(ctx.cwd);
  if (existing) return existing;
  const now = new Date().toISOString();
  return {
    meta: { ref: ctx.diff.ref, createdAt: now, updatedAt: now },
    viewed: [],
    comments: [],
  };
}

// re-runs git diff so the view reflects the repo's current state (refresh / live review),
// keeping the last good diff if git errors transiently. the first call reuses the diff already
// computed at launch — no point running git twice for the initial page load.
export function handleGetDiff(ctx: ServerContext): Response {
  if (!ctx.served) {
    ctx.served = true;
    return json(ctx.diff);
  }
  try {
    const fresh =
      ctx.mode === "browse"
        ? scanProject(ctx.cwd, ctx.scope)
        : { ...parseDiff(collectDiff(ctx.diffArgs, ctx.cwd, ctx.includeUntracked, false), ctx.diff.ref), meta: ctx.meta };
    ctx.diff = excludeReviewFile(fresh, false);
  } catch {
    // keep the previous diff
  }
  return json(ctx.diff);
}

export function handleGetComments(ctx: ServerContext): Response {
  if (ctx.reviewId) return json(readReviewRecord(ctx.reviewId) ?? {});
  return json(readReview(ctx.cwd) ?? {});
}

function currentReview(ctx: ServerContext): ReviewFile {
  if (!ctx.reviewId) return loadOrInit(ctx);
  const record = readReviewRecord(ctx.reviewId);
  if (!record) return loadOrInit(ctx);
  return {
    meta: { ref: record.target.ref, createdAt: record.createdAt, updatedAt: record.updatedAt },
    viewed: record.viewed,
    comments: record.comments,
  };
}

export async function handlePostComments(ctx: ServerContext, req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("invalid json body", 400);
  }
  const comments = (body as { comments?: unknown }).comments;
  if (!Array.isArray(comments)) {
    return apiError("comments must be an array", 400);
  }
  if (ctx.reviewId) {
    const incoming = comments as Comment[];
    return json(
      updateReviewRecord(ctx.reviewId, (record) => ({ comments: mergeReviewerComments(record.comments, incoming) }))
    );
  }
  const review = currentReview(ctx);
  review.comments = comments as Comment[];
  saveReview(ctx, review);
  return json(review);
}

export async function handlePostViewed(ctx: ServerContext, req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("invalid json body", 400);
  }
  const viewed = (body as { viewed?: unknown }).viewed;
  if (!Array.isArray(viewed)) {
    return apiError("viewed must be an array", 400);
  }
  const review = currentReview(ctx);
  review.viewed = viewed as string[];
  if (ctx.reviewId) return json(updateReviewRecord(ctx.reviewId, { viewed: review.viewed }));
  saveReview(ctx, review);
  return json(review);
}

// summary precedence: an explicit ?summary= query param, else the persisted record's
// summary for the selected Review Record, else none.
export function handleGetCompile(ctx: ServerContext, url: URL): Response {
  const review = currentReview(ctx);
  const querySummary = url.searchParams.get("summary");
  const summary = querySummary?.trim() ? querySummary : ctx.reviewId ? readReviewRecord(ctx.reviewId)?.summary : undefined;
  return json({ prompt: compileReviewPrompt(ctx.diff, review, summary) } satisfies CompilePromptResponse);
}

// reports whether a newer diffle release is published (best-effort, never throws).
export async function handleGetUpdate(ctx: ServerContext): Promise<Response> {
  return json(await checkForUpdate(ctx.loupeRoot));
}
