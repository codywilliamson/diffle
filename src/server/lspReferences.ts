// POST /api/lsp/references: every reference to the symbol, grouped by file with the diff's files
// first, capped, with a few lines of context read from the same text the reviewer sees.

import type { LspLocation, LspReference, LspReferenceFile, LspReferencesResponse } from "../types";
import { normalizeTargets, type WireRange } from "../core/lsp/protocol";
import type { ServerContext } from "./handlers";
import { json } from "./respond";
import { onDocument, readJsonBody, toWirePosition } from "./lspSession";
import { pathKey } from "./lspTargets";

export const MAX_REFERENCES = 200;
export const REFERENCE_CONTEXT_LINES = 2; // each side of the reference line

const byPlace = (a: LspLocation, b: LspLocation): number =>
  Number(b.inDiff) - Number(a.inDiff) || (a.path ?? a.absolutePath).localeCompare(b.path ?? b.absolutePath);

export async function handleLspReferences(ctx: ServerContext, req: Request): Promise<Response> {
  const body = await readJsonBody(req);
  if (body instanceof Response) return body;
  return onDocument(ctx, body.path, body.side, async (doc) => {
    const position = toWirePosition(doc, body.line, body.character);
    if (position instanceof Response) return position;
    const result = await doc.bridge.request("textDocument/references", {
      textDocument: { uri: doc.uri }, position, context: { includeDeclaration: true },
    }, { signal: req.signal });
    // cheap work first: locate, dedupe, rank and cap the wire targets, then enrich only what is kept
    const seen = new Set<string>();
    const found: Array<{ location: LspLocation; range: WireRange }> = [];
    for (const target of normalizeTargets(result)) {
      const location = doc.targets.locate(target.uri);
      if (!location) continue;
      const key = `${pathKey(location.absolutePath)}:${target.range.start.line}:${target.range.start.character}`;
      if (seen.has(key)) continue;
      seen.add(key);
      found.push({ location, range: target.range });
    }
    found.sort((a, b) => byPlace(a.location, b.location) || a.range.start.line - b.range.start.line || a.range.start.character - b.range.start.character);
    const files = new Map<string, LspReferenceFile>();
    for (const { location, range } of found.slice(0, MAX_REFERENCES)) {
      const key = pathKey(location.absolutePath);
      const file = files.get(key) ?? { ...location, changed: location.inDiff, references: [] };
      files.set(key, file);
      file.references.push(withContext(doc.targets.lines(location), doc.targets.range(location, range)));
    }
    return json({ files: [...files.values()], total: found.length, truncated: found.length > MAX_REFERENCES } satisfies LspReferencesResponse);
  });
}

function withContext(lines: string[] | undefined, range: LspReference["range"]): LspReference {
  if (!lines) return { range, contextStartLine: range.start.line, contextLines: [] };
  const first = Math.max(1, range.start.line - REFERENCE_CONTEXT_LINES);
  const last = Math.min(lines.length, range.end.line + REFERENCE_CONTEXT_LINES);
  return { range, contextStartLine: first, contextLines: lines.slice(first - 1, last) };
}

