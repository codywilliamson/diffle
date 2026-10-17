// keeps a language server's open documents equal to what the reviewer sees. a server that
// opened a file earlier will not re-read it from disk, so each request re-syncs them (cheap:
// reads are cached, see lspText.ts). syncing is serialized per server, so two requests around an
// edit can never interleave a didChange with each other's bookkeeping.

import { relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { LspBridge } from "../core/lsp/bridge";
import { waitForProgressIdle } from "../core/lsp/idle";
import { languageForPath } from "../core/lsp/registry";
import type { ServerContext } from "./handlers";
import { readRepoText, repoRootOf } from "./lspText";

export const MAX_OPEN_DOCUMENTS = 64; // least recently used documents are closed beyond this
const FALLBACK_LANGUAGE_ID = "plaintext";
const warming = new WeakMap<LspBridge, Promise<void>>();
const locks = new WeakMap<LspBridge, Promise<unknown>>();

export function serialized<T>(bridge: LspBridge, run: () => Promise<T>): Promise<T> {
  const turn = (locks.get(bridge) ?? Promise.resolve()).then(run, run);
  locks.set(bridge, turn.catch(() => undefined));
  return turn;
}

function resyncOpenDocuments(ctx: ServerContext, bridge: LspBridge, exceptUri: string | undefined): void {
  for (const uri of bridge.openDocumentUris) {
    if (uri === exceptUri) continue;
    try {
      const path = relative(repoRootOf(ctx), fileURLToPath(uri)).split(sep).join("/");
      bridge.syncDocument(uri, languageForPath(path)?.languageId ?? FALLBACK_LANGUAGE_ID, readRepoText(ctx, path));
    } catch {
      bridge.closeDocument(uri); // deleted or unreadable on the reviewed side
    }
  }
}

function evictLeastRecentlyUsed(bridge: LspBridge, keepUri: string): void {
  for (const uri of bridge.openDocumentUris) {
    if (bridge.openDocumentCount <= MAX_OPEN_DOCUMENTS) return;
    if (uri !== keepUri) bridge.closeDocument(uri);
  }
}

export interface DocumentSeed { uri: string; languageId: string; path: string }

// the first open on a server triggers its project load; answers before that finishes are unreliable.
async function openAndWarm(ctx: ServerContext, bridge: LspBridge, seed: DocumentSeed): Promise<{ text: string; version: number }> {
  const cold = bridge.openDocumentCount === 0;
  resyncOpenDocuments(ctx, bridge, seed.uri);
  const text = readRepoText(ctx, seed.path); // throws when the file is gone
  const version = bridge.syncDocument(seed.uri, seed.languageId, text);
  evictLeastRecentlyUsed(bridge, seed.uri);
  if (cold) warming.set(bridge, waitForProgressIdle(bridge));
  await warming.get(bridge);
  return { text, version };
}

// text + version the server now holds for the document; read and sent under one lock.
export function syncDocument(ctx: ServerContext, bridge: LspBridge, seed: DocumentSeed): Promise<{ text: string; version: number }> {
  return serialized(bridge, () => openAndWarm(ctx, bridge, seed));
}

// before a query that is not about one document (workspace symbols): same sync and project-load
// wait; a server with nothing open yet opens `seed` so there is a project to search.
export function prepareBridge(ctx: ServerContext, bridge: LspBridge, seed: DocumentSeed | undefined): Promise<void> {
  return serialized(bridge, async () => {
    if (bridge.openDocumentCount === 0 && seed) {
      try { await openAndWarm(ctx, bridge, seed); } catch { /* nothing to open; query anyway */ }
      return;
    }
    resyncOpenDocuments(ctx, bridge, undefined);
    await warming.get(bridge);
  });
}
