// pure normalizers for document and workspace symbol results, in wire coordinates.
// DocumentSymbol[] nests; SymbolInformation[] is flat and stays one level.

import type { WireRange } from "./protocol";

export interface WireSymbol { name: string; kind: string; detail?: string; range: WireRange; selection: WireRange; children: WireSymbol[] }
export interface WireWorkspaceSymbol { name: string; kind: string; containerName?: string; uri: string; range: WireRange }

// SymbolKind 1..26, in protocol order
const KIND_NAMES = [
  "file", "module", "namespace", "package", "class", "method", "property", "field", "constructor", "enum",
  "interface", "function", "variable", "constant", "string", "number", "boolean", "array", "object", "key",
  "null", "enum member", "struct", "event", "operator", "type parameter",
];
export const symbolKindName = (kind: unknown): string => (typeof kind === "number" ? KIND_NAMES[kind - 1] : undefined) ?? "unknown";

type Json = Record<string, any>;
const isObject = (value: unknown): value is Json => typeof value === "object" && value !== null;
const isRange = (value: unknown): value is WireRange => isObject(value) && isObject(value.start) && isObject(value.end);
const START_OF_FILE: WireRange = { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } };

function documentSymbol(item: Json): WireSymbol | undefined {
  if (typeof item.name !== "string") return undefined;
  const symbol = { name: item.name, kind: symbolKindName(item.kind), ...(typeof item.detail === "string" && item.detail ? { detail: item.detail } : {}) };
  if (isRange(item.location?.range)) {
    // SymbolInformation: flat, the container is the only hint of nesting
    const detail = typeof item.containerName === "string" && item.containerName ? { detail: item.containerName } : {};
    return { ...symbol, ...detail, range: item.location.range, selection: item.location.range, children: [] };
  }
  if (!isRange(item.range)) return undefined;
  const children = Array.isArray(item.children) ? item.children.map((child: unknown) => (isObject(child) ? documentSymbol(child) : undefined)).filter((child: WireSymbol | undefined): child is WireSymbol => !!child) : [];
  return { ...symbol, range: item.range, selection: isRange(item.selectionRange) ? item.selectionRange : item.range, children };
}

export function normalizeDocumentSymbols(result: unknown): WireSymbol[] {
  if (!Array.isArray(result)) return [];
  return result.map((item) => (isObject(item) ? documentSymbol(item) : undefined)).filter((symbol): symbol is WireSymbol => !!symbol);
}

// SymbolInformation | WorkspaceSymbol (whose location may omit the range)
export function normalizeWorkspaceSymbols(result: unknown): WireWorkspaceSymbol[] {
  if (!Array.isArray(result)) return [];
  const out: WireWorkspaceSymbol[] = [];
  for (const item of result) {
    if (!isObject(item) || typeof item.name !== "string" || typeof item.location?.uri !== "string") continue;
    out.push({
      name: item.name, kind: symbolKindName(item.kind),
      ...(typeof item.containerName === "string" && item.containerName ? { containerName: item.containerName } : {}),
      uri: item.location.uri, range: isRange(item.location.range) ? item.location.range : START_OF_FILE,
    });
  }
  return out;
}
