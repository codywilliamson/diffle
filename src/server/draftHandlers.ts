// /api/drafts — unsent comment drafts for the review this server is running (see core/draftStore).

import type { DraftBatchRequest, DraftUpdate, DraftsResponse } from "../types";
import { readDrafts, writeDrafts } from "../core/draftStore";
import { apiError, json } from "./respond";
import type { ServerContext } from "./handlers";

export const MAX_DRAFT_BODY_BYTES = 1_048_576;
export const MAX_DRAFT_UPDATES = 500;

// a durable record scopes its own drafts; a manual (legacy) review is scoped by its repo
const scopeOf = (ctx: ServerContext): string => ctx.reviewId ?? ctx.cwd;

export function handleGetDrafts(ctx: ServerContext): Response {
  return json({ drafts: readDrafts(scopeOf(ctx)) } satisfies DraftsResponse);
}

const isUpdate = (value: unknown): value is DraftUpdate =>
  !!value && typeof value === "object" && typeof (value as DraftUpdate).key === "string" && typeof (value as DraftUpdate).text === "string";

export async function handlePostDrafts(ctx: ServerContext, req: Request): Promise<Response> {
  if (Number(req.headers.get("content-length") ?? 0) > MAX_DRAFT_BODY_BYTES) return apiError("body too large", 413);
  const raw = await req.text();
  if (Buffer.byteLength(raw) > MAX_DRAFT_BODY_BYTES) return apiError("body too large", 413);
  let body: Partial<DraftBatchRequest> | null;
  try {
    body = JSON.parse(raw) as Partial<DraftBatchRequest> | null;
  } catch {
    return apiError("invalid json body", 400);
  }
  const updates = body?.updates;
  if (!Array.isArray(updates) || updates.length > MAX_DRAFT_UPDATES || !updates.every(isUpdate)) {
    return apiError(`body must set updates: up to ${MAX_DRAFT_UPDATES} of { key, text }`, 400);
  }
  return json(writeDrafts(scopeOf(ctx), updates) satisfies DraftsResponse);
}
