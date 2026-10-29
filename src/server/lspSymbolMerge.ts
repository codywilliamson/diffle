// merges workspace symbol answers from several language servers into one ordered list.
// dedupe is on file + range + name, then an exact name match leads, then the diff's files, then the
// repo's; ties keep server order. leading with exact matches means a chatty fuzzy server cannot
// push the one symbol the reviewer typed out past the cap.

import type { LspLocation, LspRange } from "../types";
import type { WireWorkspaceSymbol } from "../core/lsp/symbols";
import { pathKey, type TargetResolver } from "./lspTargets";

export interface FoundSymbol { symbol: WireWorkspaceSymbol; location: LspLocation; range: LspRange }
export interface SymbolSource { symbols: WireWorkspaceSymbol[]; resolver: TargetResolver }

const locationRank = (location: LspLocation): number => (location.inDiff ? 0 : location.inRepo ? 1 : 2);
const matchRank = (name: string, query: string): number => (name.toLowerCase() === query.toLowerCase() ? 0 : 1);

function locateAndDedupe(sources: SymbolSource[]): FoundSymbol[] {
  const seen = new Set<string>();
  const found: FoundSymbol[] = [];
  for (const { symbols, resolver } of sources) {
    for (const symbol of symbols) {
      const location = resolver.locate(symbol.uri);
      if (!location) continue;
      // client coordinates: servers on different position encodings spell one symbol differently
      const range = resolver.range(location, symbol.range);
      const { start, end } = range;
      const key = [pathKey(location.absolutePath), symbol.name, start.line, start.character, end.line, end.character].join(":");
      if (seen.has(key)) continue;
      seen.add(key);
      found.push({ symbol, location, range });
    }
  }
  return found;
}

export function mergeWorkspaceSymbols(sources: SymbolSource[], query: string): FoundSymbol[] {
  return locateAndDedupe(sources).sort((a, b) => matchRank(a.symbol.name, query) - matchRank(b.symbol.name, query) || locationRank(a.location) - locationRank(b.location));
}
