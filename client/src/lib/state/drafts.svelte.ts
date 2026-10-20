// unsent comment text, kept in memory as the reviewer types and mirrored to the server
// (/api/drafts) so it survives a closed tab and the next launch's new port. writes are debounced
// and batched. a write that fails stays dirty and retries with backoff, on the server coming
// back, and on a reachable signal. a draft the server refuses is marked rejected, not retried.

import type { CommentDrafts, DraftUpdate, DraftsResponse } from "$types";
import { getDrafts, saveDrafts } from "$lib/api/drafts";
import { ApiRequestError } from "$lib/api/http";

export const DRAFT_SAVE_DEBOUNCE_MS = 500;
export const DRAFT_RETRY_BASE_MS = 2000;
export const DRAFT_RETRY_MAX_MS = 30_000;
// browsers cap keepalive request bodies at 64KB
export const KEEPALIVE_MAX_BYTES = 60_000;
const HTTP_CLIENT_ERROR_MIN = 400;
const HTTP_SERVER_ERROR_MIN = 500;
const HTTP_REQUEST_TIMEOUT = 408;
const HTTP_TOO_MANY_REQUESTS = 429;

export interface DraftsDeps {
  load: () => Promise<CommentDrafts>;
  save: (updates: DraftUpdate[], keepalive: boolean) => Promise<DraftsResponse>;
}

const realDeps: DraftsDeps = { load: () => getDrafts(), save: (updates, keepalive) => saveDrafts(updates, keepalive) };

// a 4xx other than "try again" means this body will never be accepted
function isPermanent(error: unknown): error is ApiRequestError {
  return (
    error instanceof ApiRequestError &&
    error.status >= HTTP_CLIENT_ERROR_MIN &&
    error.status < HTTP_SERVER_ERROR_MIN &&
    error.status !== HTTP_REQUEST_TIMEOUT &&
    error.status !== HTTP_TOO_MANY_REQUESTS
  );
}

export function createDraftsStore(deps: DraftsDeps = realDeps) {
  const texts = new Map<string, string>();
  const dirty = new Set<string>();
  let rejected = $state<Record<string, string>>({});
  let loaded = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let retryDelay = DRAFT_RETRY_BASE_MS;
  let chain: Promise<void> = Promise.resolve();

  function reject(keys: string[], reason: (key: string) => string): void {
    const next = { ...rejected };
    for (const key of keys) {
      next[key] = reason(key);
      dirty.delete(key);
    }
    rejected = next;
  }

  function accept(key: string): void {
    if (!(key in rejected)) return;
    const { [key]: _gone, ...rest } = rejected;
    rejected = rest;
  }

  function scheduleRetry(): void {
    clearTimeout(retryTimer);
    retryTimer = setTimeout(() => void flush(), retryDelay);
    retryDelay = Math.min(retryDelay * 2, DRAFT_RETRY_MAX_MS);
  }

  async function sendDirty(unloading: boolean): Promise<void> {
    const updates = [...dirty].map((key) => ({ key, text: texts.get(key) ?? "" }));
    if (updates.length === 0) return;
    const keepalive = unloading && JSON.stringify(updates).length < KEEPALIVE_MAX_BYTES;
    let response: DraftsResponse;
    try {
      response = await deps.save(updates, keepalive);
    } catch (error) {
      if (isPermanent(error)) reject(updates.map((u) => u.key), () => error.message);
      else scheduleRetry();
      return;
    }
    retryDelay = DRAFT_RETRY_BASE_MS;
    const refused = new Map((response.rejected ?? []).map((r) => [r.key, r.reason]));
    reject([...refused.keys()], (key) => refused.get(key) ?? "");
    for (const { key, text } of updates) {
      if (!refused.has(key) && (texts.get(key) ?? "") === text) dirty.delete(key);
    }
    if (dirty.size > 0 && !timer) schedule();
  }

  // sends everything not yet saved, one batch at a time. unloading uses a keepalive request so
  // it survives the page going away.
  function flush(unloading = false): Promise<void> {
    clearTimeout(timer);
    timer = undefined;
    clearTimeout(retryTimer);
    retryTimer = undefined;
    if (unloading) return sendDirty(true);
    chain = chain.then(() => sendDirty(false));
    return chain;
  }

  function schedule(): void {
    clearTimeout(timer);
    timer = setTimeout(() => void flush(), DRAFT_SAVE_DEBOUNCE_MS);
  }

  function touch(key: string): void {
    accept(key);
    dirty.add(key);
  }

  // drops the keys that hold something and sends the removals as one batch
  function clearMany(keys: string[]): void {
    let changed = false;
    for (const key of keys) {
      accept(key);
      if (!texts.has(key) && !dirty.has(key)) continue;
      texts.delete(key);
      dirty.add(key);
      changed = true;
    }
    if (changed) void flush();
  }

  const clear = (key: string): void => clearMany([key]);

  return {
    // true once the server's drafts have been pulled (or the pull failed); editors opened earlier apply them then
    get loaded(): boolean {
      return loaded;
    },
    // why the server refused this draft, e.g. "draft too long to save"; null when it is fine
    rejection(key: string): string | null {
      return rejected[key] ?? null;
    },
    // pull what the server holds; anything typed since the page opened wins
    async load(): Promise<void> {
      try {
        for (const [key, text] of Object.entries(await deps.load())) {
          if (!dirty.has(key) && !texts.has(key)) texts.set(key, text);
        }
      } catch {
        // no drafts to restore; typing still works
      }
      loaded = true;
    },
    get(key: string): string | undefined {
      return texts.get(key);
    },
    // called on every keystroke: memory now, server after the debounce. empty text is a discard.
    set(key: string, text: string): void {
      if (text === "") texts.delete(key);
      else texts.set(key, text);
      touch(key);
      schedule();
    },
    // an editor's range grew: its text follows to the new anchor
    move(from: string, to: string): void {
      const text = texts.get(from);
      if (text === undefined || from === to) return;
      texts.delete(from);
      texts.set(to, text);
      touch(from);
      touch(to);
      schedule();
    },
    // sent or discarded: gone from memory, and from the server right away
    clear,
    clearMany,
    flush,
    // the server answered: a write waiting out its backoff goes now
    retryNow(): void {
      if (retryTimer) void flush();
    },
  };
}

export type DraftsStore = ReturnType<typeof createDraftsStore>;
