// GET /api/lsp/symbols: ?path= is the document outline (a tree, with the symbols the diff touches
// marked changed); ?query= asks every language server in the diff and merges what comes back.

import type { DiffFile, LspDocumentSymbolsResponse, LspLanguage, LspRange, LspSymbol, LspWorkspaceSymbol, LspWorkspaceSymbolsResponse } from "../types";
import type { LspBridge } from "../core/lsp/bridge";
import { languageForPath, languagesInPaths } from "../core/lsp/registry";
import { normalizeDocumentSymbols, normalizeWorkspaceSymbols, type WireSymbol } from "../core/lsp/symbols";
import type { ServerContext } from "./handlers";
import { json } from "./respond";
import { sideContext } from "./lspSide";
import { CANCELLED_STATUS, guarded, invalid, lspError, onDocument, sideFailure, unavailable } from "./lspSession";
import { prepareBridge } from "./lspSync";
import { mergeWorkspaceSymbols, rangeOf, type SymbolSource } from "./lspSymbolMerge";
import { fileUriOf, TargetResolver } from "./lspTargets";

export const MAX_WORKSPACE_SYMBOLS = 100;

// new-side lines the diff touches; a removal marks the line that now sits where it was.
export function changedNewLines(file: DiffFile | undefined): Set<number> {
  const changed = new Set<number>();
  for (const hunk of file?.hunks ?? []) {
    let next: number | null = null;
    let pendingRemoval = false;
    for (const line of hunk.lines) {
      if (line.newLine === null) { pendingRemoval = true; continue; }
      if (line.type === "addition" || pendingRemoval) changed.add(line.newLine);
      pendingRemoval = false;
      next = line.newLine + 1;
    }
    if (pendingRemoval && next !== null) changed.add(next);
  }
  return changed;
}

// lsp range ends are exclusive: an end at column 0 belongs to the line before it
export const lastLineOf = (range: LspRange): number => (range.end.character === 0 && range.end.line > range.start.line ? range.end.line - 1 : range.end.line);

function overlaps(changed: Set<number>, first: number, last: number): boolean {
  for (let line = first; line <= last; line++) if (changed.has(line)) return true;
  return false;
}

export function handleLspDocumentSymbols(ctx: ServerContext, path: string, signal: AbortSignal): Promise<Response> {
  return onDocument(ctx, path, "new", async (doc) => {
    const changed = changedNewLines(ctx.diff.files.find((file) => file.path === path));
    const location = doc.targets.locate(doc.uri)!;
    const convert = (symbol: WireSymbol): LspSymbol => {
      const range = doc.targets.range(location, symbol.range);
      return {
        name: symbol.name, kind: symbol.kind, ...(symbol.detail ? { detail: symbol.detail } : {}),
        range, selectionRange: doc.targets.range(location, symbol.selection),
        changed: overlaps(changed, range.start.line, lastLineOf(range)), children: symbol.children.map(convert),
      };
    };
    const result = await doc.bridge.request("textDocument/documentSymbol", { textDocument: { uri: doc.uri } }, { signal });
    return json({ path, symbols: normalizeDocumentSymbols(result).map(convert) } satisfies LspDocumentSymbolsResponse);
  });
}

export async function handleLspWorkspaceSymbols(base: ServerContext, query: string, signal: AbortSignal): Promise<Response> {
  const sided = sideContext(base, "new");
  if ("unavailable" in sided) return sideFailure("new", sided);
  const ctx = sided;
  const pool = ctx.lsp;
  const diffPaths = ctx.diff.files.map((file) => file.path);
  const languages = languagesInPaths(diffPaths);
  if (!pool?.enabled || (languages.length === 0 && pool.running().length === 0)) return unavailable(ctx, languages[0]);
  // an explicit symbol search is a request, so servers for the diff's languages may start now
  const started = await Promise.all(languages.map(async (language: LspLanguage) => ({ language, bridge: await pool.ensure(language) })));
  const entries = started.filter((entry): entry is { language: LspLanguage; bridge: LspBridge } => !!entry.bridge);
  const bridges = [...new Set([...entries.map((entry) => entry.bridge), ...pool.running()])];
  if (bridges.length === 0) return unavailable(ctx, languages[0]);
  // same preparation as a document request: current text for open files, project loaded
  await Promise.all(bridges.map((bridge) => {
    const entry = entries.find((candidate) => candidate.bridge === bridge);
    const path = entry && diffPaths.find((candidate) => languageForPath(candidate)?.language === entry.language);
    const match = path ? languageForPath(path) : undefined;
    return prepareBridge(ctx, bridge, path && match ? { uri: fileUriOf(ctx, path), languageId: match.languageId, path } : undefined);
  }));
  return guarded(ctx, languages[0], async () => {
    const answers = await Promise.allSettled(bridges.map((bridge) => bridge.request("workspace/symbol", { query }, { signal })));
    if (signal.aborted) return lspError("cancelled", "request cancelled", CANCELLED_STATUS);
    const failures = answers.filter((answer): answer is PromiseRejectedResult => answer.status === "rejected");
    if (failures.length === answers.length) {
      const reason = failures[0]?.reason;
      return lspError("request-failed", reason instanceof Error ? reason.message : "workspace symbol search failed", 502);
    }
    // locate, dedupe, rank and cap first; ranges convert lazily (see lspSymbolMerge.ts)
    const sources: SymbolSource[] = [];
    answers.forEach((answer, index) => {
      if (answer.status === "fulfilled") sources.push({ symbols: normalizeWorkspaceSymbols(answer.value), resolver: new TargetResolver(ctx, bridges[index]!.encoding) });
    });
    const found = mergeWorkspaceSymbols(sources, query);
    const symbols: LspWorkspaceSymbol[] = found.slice(0, MAX_WORKSPACE_SYMBOLS).map((kept) => ({
      ...kept.location, name: kept.symbol.name, kind: kept.symbol.kind, ...(kept.symbol.containerName ? { containerName: kept.symbol.containerName } : {}), range: rangeOf(kept),
    }));
    return json({ symbols, total: found.length, truncated: found.length > MAX_WORKSPACE_SYMBOLS } satisfies LspWorkspaceSymbolsResponse);
  });
}

export function handleGetLspSymbols(ctx: ServerContext, url: URL, signal: AbortSignal): Promise<Response> | Response {
  const path = url.searchParams.get("path");
  if (path !== null) return handleLspDocumentSymbols(ctx, path, signal);
  const query = url.searchParams.get("query");
  if (query !== null) return handleLspWorkspaceSymbols(ctx, query, signal);
  return invalid("symbols needs ?path= or ?query=");
}
