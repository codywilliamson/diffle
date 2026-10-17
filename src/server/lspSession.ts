// what every lsp navigation request does first: validate, find the language server, and make it
// see the exact text the reviewer sees. also the shared error mapping, so a missing server is a
// 409 with a hint and never a 500.

import { posix, win32 } from "node:path";
import type { LspErrorCode, LspErrorResponse, LspLanguage, LspPosition } from "../types";
import type { LspBridge } from "../core/lsp/bridge";
import { LspCancelledError, LspClosedError, LspResponseError, LspTimeoutError } from "../core/lsp/jsonRpc";
import { toLspCharacter } from "../core/lsp/positions";
import { languageForPath } from "../core/lsp/registry";
import { insideDir } from "../utils/pathWithin";
import type { ServerContext } from "./handlers";
import { json } from "./respond";
import { fileUriOf, readRepoText, repoRootOf, splitLines, TargetResolver } from "./lspTargets";
import { fileURLToPath } from "node:url";
import { syncDocument } from "./lspSync";

export const CANCELLED_STATUS = 499; // nginx's "client closed request"; no standard code fits
const OLD_SIDE_HINT = "navigating the old side needs a detached worktree (#186)";

export function lspError(code: LspErrorCode, message: string, status: number, extra: Partial<LspErrorResponse> = {}): Response {
  return json({ error: message, code, ...extra } satisfies LspErrorResponse, status);
}

export const invalid = (message: string): Response => lspError("invalid-request", message, 400);

// 409 carrying the pool status, so the client can show why nothing answers
export function unavailable(ctx: ServerContext, language: LspLanguage | undefined): Response {
  const pool = ctx.lsp;
  if (!pool?.enabled) return lspError("server-unavailable", "language servers are disabled", 409, { state: "missing", hint: "language servers are off for this run (--no-lsp)" });
  if (!language) return lspError("server-unavailable", "no language server for this file type", 409, { state: "missing", hint: "no language server is configured for this file type" });
  const status = pool.status([language])[0];
  return lspError("server-unavailable", `${language} language server is ${status?.state ?? "unavailable"}`, 409, {
    state: status?.state ?? "missing", ...(status?.hint ? { hint: status.hint } : {}), ...(status?.stderr ? { stderr: status.stderr } : {}),
  });
}

// runs a handler body and maps lsp failures onto http statuses.
export async function guarded(ctx: ServerContext, language: LspLanguage | undefined, run: () => Promise<Response>): Promise<Response> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof LspCancelledError) return lspError("cancelled", "request cancelled", CANCELLED_STATUS);
    if (error instanceof LspClosedError) return unavailable(ctx, language);
    if (error instanceof LspResponseError || error instanceof LspTimeoutError) return lspError("request-failed", error.message, 502);
    throw error;
  }
}

export interface LspDoc {
  language: LspLanguage;
  languageId: string;
  bridge: LspBridge;
  uri: string;
  path: string;
  text: string;
  lines: string[];
  targets: TargetResolver;
}

const isRepoRelative = (ctx: ServerContext, path: string): boolean =>
  path !== "" && !path.includes("..") && !posix.isAbsolute(path) && !win32.isAbsolute(path) && insideDir(repoRootOf(ctx), path);

// opens (or resyncs) `path` on its language server. the old side is refused until the detached worktree exists.
export async function openDocument(ctx: ServerContext, path: unknown, side: unknown): Promise<LspDoc | Response> {
  if (typeof path !== "string" || !isRepoRelative(ctx, path)) return invalid("path must be a repo-relative file");
  if (side !== "new" && side !== "old") return invalid("side must be old or new");
  if (side === "old") return lspError("old-side-unsupported", OLD_SIDE_HINT, 409, { hint: OLD_SIDE_HINT });
  const match = languageForPath(path);
  if (!match || !ctx.lsp?.enabled) return unavailable(ctx, match?.language);
  let text: string;
  try { text = readRepoText(ctx, path); } catch { return lspError("file-not-found", "file not found", 404); }
  const bridge = await ctx.lsp.ensure(match.language);
  if (!bridge) return unavailable(ctx, match.language);
  const uri = fileUriOf(ctx, path);
  await syncDocument(ctx, bridge, uri, match.languageId, text);
  const targets = new TargetResolver(ctx, bridge.encoding);
  targets.seed(fileURLToPath(uri), text);
  return { language: match.language, languageId: match.languageId, bridge, uri, path, text, lines: splitLines(text), targets };
}

// client position (1-based line, utf-16 character) -> wire position in the negotiated encoding.
export function toWirePosition(doc: LspDoc, line: unknown, character: unknown): LspPosition | Response {
  if (!Number.isInteger(line) || !Number.isInteger(character) || (line as number) < 1 || (character as number) < 0) return invalid("line must be >= 1 and character >= 0");
  const lineText = doc.lines[(line as number) - 1];
  if (lineText === undefined) return invalid("line is past the end of the file");
  return { line: (line as number) - 1, character: toLspCharacter(lineText, character as number, doc.bridge.encoding) };
}

export async function readJsonBody(req: Request): Promise<Record<string, unknown> | Response> {
  try {
    const body = await req.json();
    return typeof body === "object" && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>) : invalid("body must be an object");
  } catch { return invalid("invalid json body"); }
}
