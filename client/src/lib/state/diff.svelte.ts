import type { DiffResult, DiffFile, DiffMeta } from "$types";
import { getDiff } from "$lib/api/diff";

// diff loading state machine. load() is the initial fetch; refresh() re-fetches
// and keeps the last good diff on failure, mirroring the server's behavior.
export type DiffState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; diff: DiffResult }
  | { status: "error"; message: string };

type Deps = { getDiff: (signal?: AbortSignal) => Promise<DiffResult> };

const isAbort = (err: unknown): boolean =>
  err instanceof DOMException && err.name === "AbortError";

const messageOf = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);

export function createDiffStore(deps: Deps = { getDiff }) {
  let state = $state<DiffState>({ status: "idle" });
  let refreshFailed = $state(false);
  let refreshing = $state(false);
  let inflight: AbortController | null = null;

  const ready = $derived(state.status === "ready" ? state.diff : undefined);
  const files = $derived<DiffFile[]>(ready?.files ?? []);
  const ref = $derived<string>(ready?.ref ?? "");
  const meta = $derived<DiffMeta | undefined>(ready?.meta);

  // start a fresh request, cancelling any in-flight one; returns its signal.
  function begin(): AbortSignal {
    inflight?.abort();
    inflight = new AbortController();
    return inflight.signal;
  }

  return {
    get state(): DiffState {
      return state;
    },
    get files(): DiffFile[] {
      return files;
    },
    get ref(): string {
      return ref;
    },
    get meta(): DiffMeta | undefined {
      return meta;
    },
    get refreshFailed(): boolean {
      return refreshFailed;
    },
    get refreshing(): boolean {
      return refreshing;
    },
    async load(): Promise<void> {
      const signal = begin();
      state = { status: "loading" };
      refreshFailed = false;
      try {
        state = { status: "ready", diff: await deps.getDiff(signal) };
      } catch (err) {
        if (isAbort(err)) return;
        state = { status: "error", message: messageOf(err) };
      }
    },
    // re-fetch; adopt on success, otherwise keep the last good diff if we have one.
    async refresh(): Promise<void> {
      const signal = begin();
      refreshing = true;
      try {
        state = { status: "ready", diff: await deps.getDiff(signal) };
        refreshFailed = false;
      } catch (err) {
        if (isAbort(err)) return;
        if (state.status === "ready") {
          refreshFailed = true;
          return;
        }
        state = { status: "error", message: messageOf(err) };
      } finally {
        refreshing = false;
      }
    },
  };
}

export type DiffStore = ReturnType<typeof createDiffStore>;
