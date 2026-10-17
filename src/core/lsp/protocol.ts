// pure normalizers for the lsp result shapes servers disagree on. positions stay in wire form
// (0-based line, server-encoding character); converting to client coordinates happens elsewhere.

export interface WirePosition { line: number; character: number }
export interface WireRange { start: WirePosition; end: WirePosition }
// a definition-ish target: where to jump (`selection`, the name) and the whole declaration (`range`)
export interface WireTarget { uri: string; range: WireRange; selection: WireRange }

type Json = Record<string, unknown>;
const isObject = (value: unknown): value is Json => typeof value === "object" && value !== null;
const isRange = (value: unknown): value is WireRange => isObject(value) && isObject(value.start) && isObject(value.end);

function targetOf(item: unknown): WireTarget | undefined {
  if (!isObject(item)) return undefined;
  if (typeof item.targetUri === "string" && isRange(item.targetRange)) {
    // LocationLink
    return { uri: item.targetUri, range: item.targetRange, selection: isRange(item.targetSelectionRange) ? item.targetSelectionRange : item.targetRange };
  }
  if (typeof item.uri === "string" && isRange(item.range)) return { uri: item.uri, range: item.range, selection: item.range }; // Location
  return undefined;
}

// Location | Location[] | LocationLink[] | null -> targets
export function normalizeTargets(result: unknown): WireTarget[] {
  const items = Array.isArray(result) ? result : result == null ? [] : [result];
  return items.map(targetOf).filter((target): target is WireTarget => target !== undefined);
}

const before = (a: WirePosition, b: WirePosition): boolean => a.line < b.line || (a.line === b.line && a.character < b.character);

// inclusive of the end, so a cursor right after an identifier still counts as on it.
export function rangeContains(range: WireRange, position: WirePosition): boolean {
  return !before(position, range.start) && !before(range.end, position);
}

// the request sits on the definition itself when it falls inside a target's name range.
export function isOnDefinition(targets: readonly WireTarget[], uri: string, position: WirePosition, sameFile: (a: string, b: string) => boolean): boolean {
  return targets.some((target) => sameFile(target.uri, uri) && rangeContains(target.selection, position));
}


// a fence longer than any backtick run inside the text
function fenced(text: string, language: string): string {
  const longest = Math.max(0, ...(text.match(/`+/g) ?? []).map((run) => run.length));
  const ticks = "`".repeat(Math.max(3, longest + 1));
  return `${ticks}${language}\n${text}\n${ticks}`;
}

function partToMarkdown(part: unknown, languageId: string): string {
  if (typeof part === "string") return part; // a bare MarkedString is markdown
  if (!isObject(part) || typeof part.value !== "string") return "";
  if (typeof part.language === "string") return fenced(part.value, part.language); // MarkedString { language, value }
  if (part.kind === "plaintext") return fenced(part.value, languageId); // MarkupContent
  return part.value;
}

// Hover.contents: MarkedString | MarkedString[] | MarkupContent -> one markdown string
export function hoverToMarkdown(contents: unknown, languageId: string): string {
  const parts = Array.isArray(contents) ? contents : [contents];
  return parts.map((part) => partToMarkdown(part, languageId)).filter((text) => text.trim() !== "").join("\n\n");
}

