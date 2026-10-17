// GET /api/lsp/symbols: ?path= is the document outline (a tree, with the symbols the diff touches
// marked changed); ?query= asks every language server in the diff and merges what comes back.

import type { DiffFile, LspDocumentSymbolsResponse, LspLanguage, LspSymbol, LspWorkspaceSymbol, LspWorkspaceSymbolsResponse } from "../types";
import type { LspBridge } from "../core/lsp/bridge";
import { languagesInPaths } from "../core/lsp/registry";
import { normalizeDocumentSymbols, normalizeWorkspaceSymbols, type WireSymbol } from "../core/lsp/symbols";
import type { ServerContext } from "./handlers";
import { json } from "./respond";
import { guarded, invalid, openDocument, unavailable } from "./lspSession";
import { pathKey, TargetResolver } from "./lspTargets";

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

function overlaps(changed: Set<number>, first: number, last: number): boolean {
  for (let line = first; line <= last; line++) if (changed.has(line)) return true;
  return false;
}

export async function handleLspDocumentSymbols(ctx: ServerContext, path: string): Promise<Response> {
  const doc = await openDocument(ctx, path, "new");
  if (doc instanceof Response) return doc;
  const changed = changedNewLines(ctx.diff.files.find((file) => file.path === path));
  const location = doc.targets.locate(doc.uri)!;
  const convert = (symbol: WireSymbol): LspSymbol => {
    const range = doc.targets.range(location, symbol.range);
    return {
      name: symbol.name, kind: symbol.kind, ...(symbol.detail ? { detail: symbol.detail } : {}),
      range, selectionRange: doc.targets.range(location, symbol.selection),
      changed: overlaps(changed, range.start.line, range.end.line), children: symbol.children.map(convert),
    };
  };
  return guarded(ctx, doc.language, async () => {
    const result = await doc.bridge.request("textDocument/documentSymbol", { textDocument: { uri: doc.uri } });
    return json({ path, symbols: normalizeDocumentSymbols(result).map(convert) } satisfies LspDocumentSymbolsResponse);
  });
}

const rank = (symbol: LspWorkspaceSymbol): number => (symbol.inDiff ? 0 : symbol.inRepo ? 1 : 2);

export async function handleLspWorkspaceSymbols(ctx: ServerContext, query: string, signal: AbortSignal): Promise<Response> {
  const pool = ctx.lsp;
  const languages = languagesInPaths(ctx.diff.files.map((file) => file.path));
  if (!pool?.enabled || (languages.length === 0 && pool.running().length === 0)) return unavailable(ctx, languages[0]);
  // an explicit symbol search is a request, so servers for the diff's languages may start now
  const started = await Promise.all(languages.map((language: LspLanguage) => pool.ensure(language)));
  const bridges = [...new Set([...started.filter((bridge): bridge is LspBridge => !!bridge), ...pool.running()])];
  if (bridges.length === 0) return unavailable(ctx, languages[0]);
  return guarded(ctx, languages[0], async () => {
    const answers = await Promise.allSettled(bridges.map((bridge) => bridge.request("workspace/symbol", { query }, { signal })));
    if (signal.aborted) return invalid("request aborted");
    const seen = new Set<string>();
    const symbols: LspWorkspaceSymbol[] = [];
    answers.forEach((answer, index) => {
      if (answer.status !== "fulfilled") return;
      const resolver = new TargetResolver(ctx, bridges[index]!.encoding);
      for (const symbol of normalizeWorkspaceSymbols(answer.value)) {
        const location = resolver.locate(symbol.uri);
        const key = location && `${pathKey(location.absolutePath)}:${symbol.name}:${symbol.range.start.line}:${symbol.range.start.character}`;
        if (!location || seen.has(key!)) continue;
        seen.add(key!);
        symbols.push({ ...location, name: symbol.name, kind: symbol.kind, ...(symbol.containerName ? { containerName: symbol.containerName } : {}), range: resolver.range(location, symbol.range) });
      }
    });
    symbols.sort((a, b) => rank(a) - rank(b));
    return json({ symbols: symbols.slice(0, MAX_WORKSPACE_SYMBOLS), total: symbols.length, truncated: symbols.length > MAX_WORKSPACE_SYMBOLS } satisfies LspWorkspaceSymbolsResponse);
  });
}

export function handleGetLspSymbols(ctx: ServerContext, url: URL, signal: AbortSignal): Promise<Response> | Response {
  const path = url.searchParams.get("path");
  if (path !== null) return handleLspDocumentSymbols(ctx, path);
  const query = url.searchParams.get("query");
  if (query !== null) return handleLspWorkspaceSymbols(ctx, query, signal);
  return invalid("symbols needs ?path= or ?query=");
}
