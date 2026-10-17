// in-process change notification for durable review records. the cli hosts the http server in
// the same process as `--wait`, so every reviewer action lands here without polling the disk.

type Listener = () => void;

const listeners = new Map<string, Set<Listener>>();

// calls `listener` after every save of review `id`; returns an unsubscribe function.
export function onReviewSaved(id: string, listener: Listener): () => void {
  const set = listeners.get(id) ?? new Set<Listener>();
  set.add(listener);
  listeners.set(id, set);
  return () => {
    set.delete(listener);
    if (set.size === 0) listeners.delete(id);
  };
}

export function notifyReviewSaved(id: string): void {
  for (const listener of [...(listeners.get(id) ?? [])]) listener();
}
