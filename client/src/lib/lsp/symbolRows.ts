// turns server symbols into the picker's flat rows and ranks them against a query. pure.

import type { LspSymbol, LspWorkspaceSymbol } from "$types";
import { matchSymbol } from "./fuzzy";
import { targetOf, type JumpTarget } from "./jump";

export interface SymbolRow {
  key: string;
  name: string;
  kind: string;
  detail?: string;
  depth: number; // nesting in the file's outline, 0 for workspace results
  container?: string; // the parent symbol, shown dimmed beside the name
  changed: boolean; // overlaps a changed line of the diff
  target: JumpTarget;
  indices: number[]; // matched characters of the name
}

// the outline of one file, depth first, parents before their children
export function documentRows(path: string, symbols: LspSymbol[]): SymbolRow[] {
  const rows: SymbolRow[] = [];
  const walk = (list: LspSymbol[], depth: number, container?: string): void => {
    for (const symbol of list) {
      rows.push({
        key: `${rows.length}:${symbol.name}`,
        name: symbol.name,
        kind: symbol.kind,
        ...(symbol.detail ? { detail: symbol.detail } : {}),
        depth,
        ...(container ? { container } : {}),
        changed: symbol.changed,
        target: { path, absolutePath: "", inRepo: true, line: symbol.selectionRange.start.line, character: symbol.selectionRange.start.character },
        indices: [],
      });
      walk(symbol.children, depth + 1, symbol.name);
    }
  };
  walk(symbols, 0);
  return rows;
}

export function workspaceRows(symbols: LspWorkspaceSymbol[]): SymbolRow[] {
  return symbols.map((symbol, i) => ({
    key: `${i}:${symbol.uri}:${symbol.name}`,
    name: symbol.name,
    kind: symbol.kind,
    depth: 0,
    ...(symbol.containerName ? { container: symbol.containerName } : {}),
    changed: false, // the server only knows line overlap for a file's own outline
    target: targetOf(symbol, symbol.range),
    indices: [],
  }));
}

// no query: the outline as it is. with one: matching rows, best first, flat (nesting means
// nothing once the order is by score). `keepRest` leaves non-matching rows at the end, for
// workspace results the server already filtered by its own rules.
export function visibleRows(rows: SymbolRow[], query: string, keepRest = false): SymbolRow[] {
  if (query.trim() === "") return rows;
  const ranked: { row: SymbolRow; score: number; order: number }[] = [];
  const rest: SymbolRow[] = [];
  rows.forEach((row, order) => {
    const match = matchSymbol(query, row.name);
    if (match) ranked.push({ row: { ...row, depth: 0, indices: match.indices }, score: match.score, order });
    else if (keepRest) rest.push(row);
  });
  ranked.sort((a, b) => a.score - b.score || a.order - b.order);
  return [...ranked.map((r) => r.row), ...rest];
}
