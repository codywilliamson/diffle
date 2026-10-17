// POST /api/lsp/references: every reference to the symbol, grouped by file with the diff's files
// first, capped, with a few lines of context read from the same text the reviewer sees.

import type { LspLocation, LspReference, LspReferenceFile, LspReferencesResponse } from "../types";
import { normalizeTargets } from "../core/lsp/protocol";
import type { ServerContext } from "./handlers";
import { json } from "./respond";
import { guarded, openDocument, readJsonBody, toWirePosition } from "./lspSession";
import { pathKey } from "./lspTargets";

export const MAX_REFERENCES = 200;
export const REFERENCE_CONTEXT_LINES = 2; // each side of the reference line

const byPlace = (a: LspLocation, b: LspLocation): number =>
  Number(b.inDiff) - Number(a.inDiff) || (a.path ?? a.absolutePath).localeCompare(b.path ?? b.absolutePath);

export async function handleLspReferences(ctx: ServerContext, req: Request): Promise<Response> {
  const body = await readJsonBody(req);
  if (body instanceof Response) return body;
  const doc = await openDocument(ctx, body.path, body.side);
  if (doc instanceof Response) return doc;
  const position = toWirePosition(doc, body.line, body.character);
  if (position instanceof Response) return position;
  return guarded(ctx, doc.language, async () => {
    const result = await doc.bridge.request("textDocument/references", {
      textDocument: { uri: doc.uri }, position, context: { includeDeclaration: true },
    }, { signal: req.signal });
    const groups = new Map<string, { location: LspLocation; found: LspReference[] }>();
    const seen = new Set<string>();
    let total = 0;
    for (const target of normalizeTargets(result)) {
      const location = doc.targets.locate(target.uri);
      if (!location) continue;
      const dedupe = `${pathKey(location.absolutePath)}:${target.range.start.line}:${target.range.start.character}`;
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);
      total++;
      const group = groups.get(pathKey(location.absolutePath)) ?? { location, found: [] };
      groups.set(pathKey(location.absolutePath), group);
      group.found.push(withContext(doc.targets.lines(location), doc.targets.range(location, target.range)));
    }
    const files: LspReferenceFile[] = [];
    let budget = MAX_REFERENCES;
    for (const { location, found } of [...groups.values()].sort((a, b) => byPlace(a.location, b.location))) {
      if (budget <= 0) break;
      found.sort((a, b) => a.range.start.line - b.range.start.line || a.range.start.character - b.range.start.character);
      const references = found.slice(0, budget);
      budget -= references.length;
      files.push({ ...location, changed: location.inDiff, references });
    }
    return json({ files, total, truncated: total > MAX_REFERENCES } satisfies LspReferencesResponse);
  });
}

function withContext(lines: string[] | undefined, range: LspReference["range"]): LspReference {
  if (!lines) return { range, contextStartLine: range.start.line, contextLines: [] };
  const first = Math.max(1, range.start.line - REFERENCE_CONTEXT_LINES);
  const last = Math.min(lines.length, range.end.line + REFERENCE_CONTEXT_LINES);
  return { range, contextStartLine: first, contextLines: lines.slice(first - 1, last) };
}

