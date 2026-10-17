// keeps a language server's open documents equal to what the reviewer sees. a server that
// opened a file earlier will not re-read it from disk, so every request re-syncs them all.

import { relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { LspBridge } from "../core/lsp/bridge";
import { waitForProgressIdle } from "../core/lsp/idle";
import { languageForPath } from "../core/lsp/registry";
import type { ServerContext } from "./handlers";
import { readRepoText, repoRootOf } from "./lspTargets";

const FALLBACK_LANGUAGE_ID = "plaintext";
const warming = new WeakMap<LspBridge, Promise<void>>();

export function resyncOpenDocuments(ctx: ServerContext, bridge: LspBridge, exceptUri: string): void {
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

// the first open on a server triggers its project load; answers before that finishes are unreliable.
export async function syncDocument(ctx: ServerContext, bridge: LspBridge, uri: string, languageId: string, text: string): Promise<void> {
  const cold = bridge.openDocumentCount === 0;
  resyncOpenDocuments(ctx, bridge, uri);
  bridge.syncDocument(uri, languageId, text);
  if (cold) warming.set(bridge, waitForProgressIdle(bridge));
  await warming.get(bridge);
}
