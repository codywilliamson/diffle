// GET /api/lsp/status — per-language server state for the languages in the current diff.
// read-only: asking for status never starts a server.

import type { LspStatusResponse } from "../types";
import { languagesInPaths } from "../core/lsp/registry";
import type { ServerContext } from "./handlers";
import { json } from "./respond";

export function handleGetLspStatus(ctx: ServerContext): Response {
  const pool = ctx.lsp;
  const body: LspStatusResponse = pool?.enabled
    ? { enabled: true, languages: pool.status(languagesInPaths(ctx.diff.files.map((file) => file.path))) }
    : { enabled: false, languages: [] };
  return json(body);
}
