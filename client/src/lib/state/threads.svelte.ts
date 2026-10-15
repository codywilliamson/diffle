// which line threads are collapsed to a pip. a thread here is the comments anchored at one
// (side, end line). resolved threads collapse by default; the reader's own toggle overrides
// that, keyed by the thread's first comment AND its resolved state, so resolving a thread the
// reader had opened collapses it again. per-viewer convenience state, kept in localStorage.

import type { Comment } from "$types";
import { isResolved } from "./reviewRecord";
import { readMigrated, writeKey, type StorageLike } from "./prefs-storage";

const allResolved = (list: Comment[]) => list.length > 0 && list.every(isResolved);
const keyOf = (list: Comment[]) => `${list[0]?.id}:${allResolved(list) ? "r" : "o"}`;

function parse(raw: string | null): Record<string, boolean> {
  try {
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

export function createThreadsStore(reviewId: string | undefined, injected?: StorageLike) {
  const storage = injected ?? (typeof window !== "undefined" ? window.localStorage : undefined);
  const name = `threads-${reviewId ?? "legacy"}`;
  let overrides = $state<Record<string, boolean>>(storage ? parse(readMigrated(storage, name)) : {});

  const isCollapsed = (list: Comment[]): boolean => list.length > 0 && (overrides[keyOf(list)] ?? allResolved(list));

  function setCollapsed(list: Comment[], collapsed: boolean): void {
    if (list.length === 0) return;
    overrides = { ...overrides, [keyOf(list)]: collapsed };
    if (storage) writeKey(storage, name, JSON.stringify(overrides));
  }

  return {
    isCollapsed,
    setCollapsed,
    toggle: (list: Comment[]) => setCollapsed(list, !isCollapsed(list)),
  };
}

export type ThreadsStore = ReturnType<typeof createThreadsStore>;
