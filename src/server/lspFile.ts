// GET /api/lsp/file?uri=: read-only text for a navigation target outside the diff (an unchanged
// repo file, a stdlib or dependency file). it only serves paths this server already handed out as
// targets, so it can never be pointed at an arbitrary file.

import { fileURLToPath } from "node:url";
import type { LspFileResponse } from "../types";
import type { ServerContext } from "./handlers";
import { json } from "./respond";
import { invalid, lspError } from "./lspSession";
import { allowedTargetOwner, TargetResolver } from "./lspTargets";

export function handleGetLspFile(ctx: ServerContext, url: URL): Response {
  const uri = url.searchParams.get("uri");
  if (!uri || !uri.startsWith("file:")) return invalid("uri must be a file: uri");
  let absolutePath: string;
  try { absolutePath = fileURLToPath(uri); } catch { return invalid("malformed uri"); }
  const owner = allowedTargetOwner(ctx, absolutePath);
  if (!owner) return lspError("forbidden", "not a navigation target", 403);
  const resolver = new TargetResolver(owner, "utf-16");
  const location = resolver.locate(uri);
  const content = location && resolver.text(location);
  if (!location || content === undefined) return lspError("file-not-found", "file not found or too large", 404);
  return json({ ...location, content } satisfies LspFileResponse);
}
