// merges workspace symbol answers from several language servers into one ordered list.
// dedupe is on file + range + name, then an exact name match leads, then the diff's files, then the
// repo's; ties keep server order. leading with exact matches means a chatty fuzzy server cannot
// push the one symbol the reviewer typed out past the cap.
// ranges are converted to client coordinates lazily: converting reads the file, so only symbols
// sharing a file and name (possible cross-server duplicates) convert before the cap, and the rest
// convert once they are kept (rangeOf).

import type { LspLocation, LspRange } from "../types";
import type { WireWorkspaceSymbol } from "../core/lsp/symbols";
import { pathKey, type TargetResolver } from "./lspTargets";

export interface FoundSymbol { symbol: WireWorkspaceSymbol; location: LspLocation; resolver: TargetResolver; range?: LspRange }
export interface SymbolSource { symbols: WireWorkspaceSymbol[]; resolver: TargetResolver }

const locationRank = (location: LspLocation): number => (location.inDiff ? 0 : location.inRepo ? 1 : 2);
const matchRank = (name: string, query: string): number => (name.toLowerCase() === query.toLowerCase() ? 0 : 1);

export function rangeOf(found: FoundSymbol): LspRange {
  found.range ??= found.resolver.range(found.location, found.symbol.range);
  return found.range;
}

function locate(sources: SymbolSource[]): FoundSymbol[] {
  const located: FoundSymbol[] = [];
  for (const { symbols, resolver } of sources) {
    for (const symbol of symbols) {
      const location = resolver.locate(symbol.uri);
      if (location) located.push({ symbol, location, resolver });
    }
  }
  return located;
}

// servers on different position encodings spell one symbol with different offsets, so duplicates
// are judged on converted ranges; a lone file + name pair cannot be a duplicate and stays raw.
function dedupe(located: FoundSymbol[]): FoundSymbol[] {
  const sameFileAndName = (found: FoundSymbol) => `${pathKey(found.location.absolutePath)}:${found.symbol.name}`;
  const counts = new Map<string, number>();
  for (const found of located) counts.set(sameFileAndName(found), (counts.get(sameFileAndName(found)) ?? 0) + 1);
  const seen = new Set<string>();
  return located.filter((found) => {
    const group = sameFileAndName(found);
    if (counts.get(group) === 1) return true;
    const { start, end } = rangeOf(found);
    const key = `${group}:${start.line}:${start.character}:${end.line}:${end.character}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function mergeWorkspaceSymbols(sources: SymbolSource[], query: string): FoundSymbol[] {
  return dedupe(locate(sources)).sort((a, b) => matchRank(a.symbol.name, query) - matchRank(b.symbol.name, query) || locationRank(a.location) - locationRank(b.location));
}
