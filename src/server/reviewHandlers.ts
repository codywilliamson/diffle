import {
  approveReview, cancelReview, detectLegacyReview, importLegacyReview, readReviewRecord,
  removeLegacyReview, replyToComment, returnFeedback, setCommentStatus, updateReviewRecord,
} from "../core/reviewRecords";
import { captureRound } from "../core/reviewRounds";
import type { ReviewRecord } from "../types";
import type { ServerContext } from "./handlers";
import { apiError, json } from "./respond";

function bodyError(message: string): Response { return apiError(message, 400); }
async function readBody(req: Request): Promise<Record<string, unknown> | Response> {
  try {
    const value: unknown = await req.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) return bodyError("body must be an object");
    return value as Record<string, unknown>;
  } catch { return bodyError("invalid json body"); }
}
function text(value: unknown, name: string, required = true): string | undefined | Response {
  if (value === undefined && !required) return undefined;
  if (typeof value !== "string" || (required && value.trim() === "")) return bodyError(`${name} must be text`);
  return value.trim();
}
function idOf(body: Record<string, unknown>): string | Response {
  return text(body.id ?? body.reviewId, "id") as string | Response;
}
function replyId(body: Record<string, unknown>): string | Response {
  return text(body.commentId, "commentId") as string | Response;
}

export function handleGetReview(url: URL, selectedId?: string): Response {
  const id = url.searchParams.get("id") ?? selectedId;
  if (!id) return bodyError("id is required");
  const record = readReviewRecord(id);
  return record ? json(record) : apiError("review record not found", 404);
}

// remembers the new-side content at hand-off so the next round can show an interdiff; never blocks feedback
function withRound(record: ReviewRecord, ctx?: ServerContext): ReviewRecord {
  if (!ctx) return record;
  try {
    const lastRound = captureRound(ctx.cwd, ctx.newRef, ctx.diff.files.map((file) => file.path));
    return updateReviewRecord(record.id, { lastRound });
  } catch { return record; }
}

export async function handleReviewOutcome(req: Request, ctx?: ServerContext): Promise<Response> {
  const body = await readBody(req); if (body instanceof Response) return body;
  const id = idOf(body); if (id instanceof Response) return id;
  const outcome = body.outcome;
  const summary = text(body.summary, "summary", false); if (summary instanceof Response) return summary;
  try {
    if (outcome === "feedback") return json(withRound(returnFeedback(id, summary), ctx));
    if (outcome === "approved") return json(approveReview(id, body.acknowledgeUnresolved === true));
    if (outcome === "cancelled") return json(cancelReview(id, summary));
    return bodyError("outcome must be feedback, approved, or cancelled");
  } catch (error) { return apiError(error instanceof Error ? error.message : "review transition failed", 409); }
}

export async function handleReviewReply(req: Request): Promise<Response> {
  const body = await readBody(req); if (body instanceof Response) return body;
  const id = idOf(body); if (id instanceof Response) return id;
  const commentId = replyId(body); if (commentId instanceof Response) return commentId;
  const message = text(body.text, "text"); if (message instanceof Response || message === undefined) return message ?? bodyError("text is required");
  // the http api is the browser's port — the reviewer replies here; agents reply via mcp.
  try { return json(replyToComment(id, commentId, message, "reviewer")); }
  catch (error) { return apiError(error instanceof Error ? error.message : "reply failed", 409); }
}

export async function handleReviewStatus(req: Request): Promise<Response> {
  const body = await readBody(req); if (body instanceof Response) return body;
  const id = idOf(body); if (id instanceof Response) return id;
  const commentId = replyId(body); if (commentId instanceof Response) return commentId;
  if (body.status !== "resolved" && body.status !== "open") return bodyError("status must be resolved or open");
  try { return json(setCommentStatus(id, commentId, body.status, "reviewer")); }
  catch (error) { return apiError(error instanceof Error ? error.message : "status update failed", 409); }
}

export async function handleLegacyReview(req: Request, cwd: string): Promise<Response> {
  const body = await readBody(req); if (body instanceof Response) return body;
  if (body.action === "ignore") return json({ legacy: detectLegacyReview(cwd), ignored: true });
  if (body.action === "remove") {
    if (body.confirm !== true) return bodyError("remove requires confirm=true");
    return json({ removed: removeLegacyReview(cwd) });
  }
  if (body.action === "import") {
    const id = text(body.id, "id"); if (id instanceof Response || id === undefined) return id ?? bodyError("id is required");
    try { return json(importLegacyReview(id, cwd)); }
    catch (error) { return apiError(error instanceof Error ? error.message : "legacy import failed", 409); }
  }
  return bodyError("action must be import, remove, or ignore");
}

export function handleGetLegacyReview(cwd: string): Response {
  return json({ present: detectLegacyReview(cwd) });
}
