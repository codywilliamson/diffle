// /api/drafts — unsent comment drafts for the review this server is running (see core/draftStore).

import type { DraftUpdateRequest } from "../types";
import { readDrafts, writeDraft } from "../core/draftStore";
import { apiError, json } from "./respond";
import type { ServerContext } from "./handlers";

// a durable record scopes its own drafts; a manual (legacy) review is scoped by its repo
const scopeOf = (ctx: ServerContext): string => ctx.reviewId ?? ctx.cwd;

export function handleGetDrafts(ctx: ServerContext): Response {
  return json({ drafts: readDrafts(scopeOf(ctx)) });
}

export async function handlePostDraft(ctx: ServerContext, req: Request): Promise<Response> {
  let body: Partial<DraftUpdateRequest>;
  try {
    body = (await req.json()) as Partial<DraftUpdateRequest>;
  } catch {
    return apiError("invalid json body", 400);
  }
  if (typeof body.key !== "string" || typeof body.text !== "string") {
    return apiError("body must set key (string) and text (string)", 400);
  }
  const result = writeDraft(scopeOf(ctx), body.key, body.text);
  if (typeof result === "string") return apiError(result, 400);
  return json({ drafts: result });
}
