import { untrack } from "svelte";
import type { DiffFile, InterdiffResponse } from "$types";
import { getInterdiff } from "$lib/api/analysis";

export type InterdiffState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; file: DiffFile | null }
  | { status: "error"; message: string };

interface Source {
  path: string;
  enabled: boolean;
  version: unknown; // changes when the diff refreshes, forcing a refetch
}

type Fetcher = (path: string, signal: AbortSignal) => Promise<InterdiffResponse>;

// loads one file's interdiff while enabled; keeps the last result visible during a refetch.
export function createInterdiff(source: () => Source, fetcher: Fetcher = getInterdiff) {
  let state = $state<InterdiffState>({ status: "idle" });

  $effect(() => {
    const { path, enabled } = source();
    if (!enabled) {
      state = { status: "idle" };
      return;
    }
    const controller = new AbortController();
    if (untrack(() => state.status) !== "ready") state = { status: "loading" };
    fetcher(path, controller.signal).then(
      (r) => {
        if (!controller.signal.aborted) state = { status: "ready", file: r.file };
      },
      (err: unknown) => {
        if (!controller.signal.aborted) state = { status: "error", message: err instanceof Error ? err.message : "Could not load changes." };
      },
    );
    return () => controller.abort();
  });

  return {
    get state(): InterdiffState {
      return state;
    },
  };
}
