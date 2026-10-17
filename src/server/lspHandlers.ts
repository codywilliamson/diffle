// lsp routes. status is read-only and never starts a server; definition and hover start the
// language's server on first use. everything below the guard in router.ts shares its
// origin + loopback Host checks.

import type { LspDefinitionResponse, LspHoverResponse, LspStatusResponse, LspTarget } from "../types";
import { hoverToMarkdown, isOnDefinition, normalizeTargets } from "../core/lsp/protocol";
import { languagesInPaths } from "../core/lsp/registry";
import type { ServerContext } from "./handlers";
import { json } from "./respond";
import { guarded, invalid, openDocument, readJsonBody, toWirePosition } from "./lspSession";
import { sameFile } from "./lspTargets";

const DEFINITION_METHODS = { definition: "textDocument/definition", typeDefinition: "textDocument/typeDefinition" } as const;
const CLIENT_HEADER = "x-client-id"; // optional: one live hover per client

export function handleGetLspStatus(ctx: ServerContext): Response {
  const pool = ctx.lsp;
  const body: LspStatusResponse = pool?.enabled
    ? { enabled: true, languages: pool.status(languagesInPaths(ctx.diff.files.map((file) => file.path))) }
    : { enabled: false, languages: [] };
  return json(body);
}

export async function handleLspDefinition(ctx: ServerContext, req: Request): Promise<Response> {
  const body = await readJsonBody(req);
  if (body instanceof Response) return body;
  const kind = body.kind ?? "definition";
  if (kind !== "definition" && kind !== "typeDefinition") return invalid("kind must be definition or typeDefinition");
  const doc = await openDocument(ctx, body.path, body.side);
  if (doc instanceof Response) return doc;
  const position = toWirePosition(doc, body.line, body.character);
  if (position instanceof Response) return position;
  return guarded(ctx, doc.language, async () => {
    const result = await doc.bridge.request(DEFINITION_METHODS[kind], { textDocument: { uri: doc.uri }, position }, { signal: req.signal });
    const wire = normalizeTargets(result);
    const seen = new Set<string>();
    const targets: LspTarget[] = [];
    for (const target of wire) {
      const location = doc.targets.locate(target.uri);
      const key = location && `${location.absolutePath}:${target.selection.start.line}:${target.selection.start.character}`;
      if (!location || seen.has(key!)) continue;
      seen.add(key!);
      targets.push({ ...location, range: doc.targets.range(location, target.selection) });
    }
    const onDefinition = kind === "definition" && isOnDefinition(wire, doc.uri, position, sameFile);
    return json({ targets, onDefinition } satisfies LspDefinitionResponse);
  });
}

const hoverInFlight = new WeakMap<ServerContext, Map<string, AbortController>>();

// a newer hover from the same client aborts the one still waiting on the server; the http
// request's own signal covers a client that simply goes away.
export async function handleLspHover(ctx: ServerContext, req: Request): Promise<Response> {
  const body = await readJsonBody(req);
  if (body instanceof Response) return body;
  const doc = await openDocument(ctx, body.path, body.side);
  if (doc instanceof Response) return doc;
  const position = toWirePosition(doc, body.line, body.character);
  if (position instanceof Response) return position;
  const live = hoverInFlight.get(ctx) ?? new Map<string, AbortController>();
  hoverInFlight.set(ctx, live);
  const client = req.headers.get(CLIENT_HEADER) ?? "";
  live.get(client)?.abort();
  const mine = new AbortController();
  live.set(client, mine);
  return guarded(ctx, doc.language, async () => {
    try {
      const result = await doc.bridge.request<{ contents?: unknown; range?: unknown } | null>(
        "textDocument/hover", { textDocument: { uri: doc.uri }, position }, { signal: AbortSignal.any([req.signal, mine.signal]) },
      );
      const contents = hoverToMarkdown(result?.contents, doc.languageId);
      const location = doc.targets.locate(doc.uri)!;
      const wireRange = result?.range as Parameters<typeof doc.targets.range>[1] | undefined;
      const range = wireRange?.start && wireRange.end ? doc.targets.range(location, wireRange) : undefined;
      return json({ contents, ...(range ? { range } : {}) } satisfies LspHoverResponse);
    } finally {
      if (live.get(client) === mine) live.delete(client);
    }
  });
}
