// unsent comment text, kept in memory as the reviewer types and mirrored to the server
// (/api/drafts) so it survives a closed tab and the next launch's new port. writes are debounced.
// while the server is gone the write throws, the draft stays marked dirty, and flush() on
// recovery sends it.

import type { CommentDrafts } from "$types";
import { getDrafts, saveDraft } from "$lib/api/drafts";

export const DRAFT_SAVE_DEBOUNCE_MS = 500;

export interface DraftsDeps {
  load: () => Promise<CommentDrafts>;
  save: (key: string, text: string) => Promise<unknown>;
}

const realDeps: DraftsDeps = { load: () => getDrafts(), save: (key, text) => saveDraft(key, text) };

export function createDraftsStore(deps: DraftsDeps = realDeps) {
  const texts = new Map<string, string>();
  const dirty = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let chain: Promise<void> = Promise.resolve();

  async function sendDirty(): Promise<void> {
    for (const key of [...dirty]) {
      const sent = texts.get(key) ?? "";
      try {
        await deps.save(key, sent);
      } catch {
        return; // server gone or refused: stay dirty, flush() retries on recovery
      }
      if ((texts.get(key) ?? "") === sent) dirty.delete(key);
    }
  }

  // sends everything not yet saved, one flush at a time
  function flush(): Promise<void> {
    clearTimeout(timer);
    timer = undefined;
    chain = chain.then(sendDirty);
    return chain;
  }

  function schedule(): void {
    clearTimeout(timer);
    timer = setTimeout(() => void flush(), DRAFT_SAVE_DEBOUNCE_MS);
  }

  function clear(key: string): void {
    if (!texts.has(key) && !dirty.has(key)) return;
    texts.delete(key);
    dirty.add(key);
    void flush();
  }

  return {
    // pull what the server holds; anything typed since the page opened wins
    async load(): Promise<void> {
      try {
        for (const [key, text] of Object.entries(await deps.load())) {
          if (!dirty.has(key) && !texts.has(key)) texts.set(key, text);
        }
      } catch {
        // no drafts to restore; typing still works
      }
    },
    get(key: string): string | undefined {
      return texts.get(key);
    },
    // called on every keystroke: memory now, server after the debounce. empty text is a discard.
    set(key: string, text: string): void {
      if (text === "") texts.delete(key);
      else texts.set(key, text);
      dirty.add(key);
      schedule();
    },
    // sent or discarded: gone from memory, and from the server right away
    clear,
    clearAll(keys: string[]): void {
      keys.forEach(clear);
    },
    flush,
  };
}

export type DraftsStore = ReturnType<typeof createDraftsStore>;
